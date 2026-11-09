"""Mail to members: the day-before reminder and the change notice.

Only members who added an email get either — an icon account has no address
unless its owner chose to give one. Both mails describe the program in
America/Toronto, where it happens, whatever zone the reader is in.
"""

import html
import logging
import uuid
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session, joinedload

from app.core import mail
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.attendance import SAVED, Attendance
from app.models.care import CareLink
from app.models.event import Event
from app.models.user import User
from app.schemas.auth import NAME_MAX

log = logging.getLogger(__name__)

TZ = ZoneInfo("America/Toronto")

# The EventUpdate fields whose change is worth a mail: when and where.
NOTICE_FIELDS = ("starts_at", "ends_at", "location")


def when_text(event: Event) -> str:
    """"Tuesday, October 6, 2026, 1:00 PM – 3:00 PM" in Toronto time."""
    if not event.starts_at:
        return "Date to be announced"
    start = event.starts_at.astimezone(TZ)
    text = start.strftime("%A, %B %-d, %Y, %-I:%M %p")
    if event.ends_at:
        text += f" – {event.ends_at.astimezone(TZ).strftime('%-I:%M %p')}"
    return text


def program_url(event: Event) -> str:
    return f"{settings.FRONTEND_ORIGIN}/events/{event.id}"


def ics_url(event: Event) -> str:
    # The API's public path: under /api in production, bare locally.
    return f"{settings.FRONTEND_ORIGIN}{settings.ROOT_PATH}/events/{event.id}/calendar.ics"


def _picture(event: Event) -> str:
    """The program's picture for the mail's card: its own, else the stock
    photo the site shows for it, cropped for email (/events/{id}/photo)."""
    if event.cover_image_url:
        return event.cover_image_url
    if event.images:
        return event.images[0].url
    return f"{program_url(event)}/photo"


def _where(event: Event) -> str:
    return event.location or ("Online" if event.is_virtual else "Location to be announced")


# ---------- reminders ----------


def _program_lines(event: Event) -> list[str]:
    return [
        "",
        event.title,
        when_text(event),
        _where(event),
        f"Add to calendar: {ics_url(event)}",
    ]


def send_reminders(db: Session, now: datetime | None = None) -> dict:
    """Mail every member with an email whose saved programs start tomorrow
    (Toronto), once, and mark the rows so the next run skips them.

    Each linked caregiver with an email gets one mail too, grouped by the
    members they support. It rides on the same `reminded_at` stamp: the
    member's rows are marked once whether one mail went out or three, so
    nothing is sent twice.
    """
    now = now or datetime.now(timezone.utc)
    tomorrow = now.astimezone(TZ).date() + timedelta(days=1)
    start = datetime.combine(tomorrow, time.min, TZ)
    end = start + timedelta(days=1)

    rows = (
        db.query(Attendance, Event, User)
        .join(Event, Event.id == Attendance.event_id)
        .join(User, User.id == Attendance.user_id)
        .filter(
            Attendance.status == SAVED,
            Attendance.reminded_at.is_(None),
            Event.deleted_at.is_(None),
            Event.starts_at >= start,
            Event.starts_at < end,
            User.deleted_at.is_(None),
        )
        .options(joinedload(Event.host))
        .order_by(Event.starts_at.asc(), Event.id.asc())
        .all()
    )

    by_member: dict[uuid.UUID, list[tuple[Attendance, Event, User]]] = {}
    for row in rows:
        by_member.setdefault(row[2].id, []).append(row)

    # Who hears about each member: the caregivers linked to them who have an
    # address. An icon-account member with no email still reaches their
    # caregiver this way.
    by_caregiver: dict[uuid.UUID, tuple[User, list[tuple[User, list[Event]]]]] = {}
    if by_member:
        links = (
            db.query(CareLink)
            .join(User, User.id == CareLink.caregiver_id)
            .filter(
                CareLink.member_id.in_(by_member.keys()),
                CareLink.removed_at.is_(None),
                User.deleted_at.is_(None),
                User.email.isnot(None),
            )
            .options(joinedload(CareLink.caregiver))
            .all()
        )
        for link in links:
            entries = by_member[link.member_id]
            member = entries[0][2]
            events = [event for _, event, _ in entries]
            by_caregiver.setdefault(link.caregiver_id, (link.caregiver, []))[1].append(
                (member, events)
            )

    for entries in by_member.values():
        user = entries[0][2]
        events = [event for _, event, _ in entries]
        if user.email:
            lines = [f"Hello {user.first_name},", "", "Tomorrow you have:"]
            for event in events:
                lines += _program_lines(event)
            lines += ["", "See you there."]
            mail.send(
                user.email,
                "Tomorrow: " + ", ".join(e.title for e in events),
                "\n".join(lines),
                button=("Open my saved programs", settings.FRONTEND_ORIGIN),
                pictures=[_picture(e) for e in events],
            )
        # Marked whether or not the SMTP hand-off succeeded: a retry tomorrow
        # would be about a different day, so a failed send is logged and gone
        # rather than left to re-fire. Committed per member, right after the
        # send, so a timeout partway through the run can't roll back stamps
        # for mail that has already gone out and re-send it next time.
        for attendance, _, _ in entries:
            attendance.reminded_at = now
        db.commit()

    # After the stamps: a run that dies here loses the caregiver copy for
    # today rather than sending anyone's twice tomorrow.
    for caregiver, members in by_caregiver.values():
        lines = [f"Hello {caregiver.first_name},", ""]
        for member, events in members:
            lines.append(f"Tomorrow {member.first_name} has:")
            for event in events:
                lines += _program_lines(event)
            lines.append("")
        names = ", ".join(member.first_name for member, _ in members)
        mail.send(
            caregiver.email,
            f"Tomorrow for {names}",
            "\n".join(lines).rstrip() + "\n",
            button=("Open saved programs", settings.FRONTEND_ORIGIN),
            pictures=[_picture(e) for _, evs in members for e in evs],
        )
    return {
        "members": len(by_member),
        "programs": len(rows),
        "caregivers": len(by_caregiver),
    }


# ---------- change notices ----------


def send_change_notice(event_id: uuid.UUID, changed: list[str]) -> None:
    """Tell everyone who saved the program that its time or place moved.

    Runs after the response, on a background task, so it opens its own
    session. One mail per member — the PK on event_attendees already makes a
    member one row per date.
    """
    db = SessionLocal()
    try:
        event = (
            db.query(Event)
            .options(joinedload(Event.host))
            .filter(Event.id == event_id, Event.deleted_at.is_(None))
            .first()
        )
        if not event:
            return
        members = (
            db.query(User)
            .join(Attendance, Attendance.user_id == User.id)
            .filter(
                Attendance.event_id == event_id,
                Attendance.status == SAVED,
                User.deleted_at.is_(None),
                User.email.isnot(None),
            )
            .all()
        )
        what = (
            "time and location"
            if "location" in changed and len(changed) > 1
            else "location"
            if changed == ["location"]
            else "time"
        )
        for user in members:
            mail.send(
                user.email,
                f"Change to {event.title}",
                f"""Hello {user.first_name},

The {what} of a program you saved has changed.

{event.title}
{when_text(event)}
{_where(event)}
Add to calendar: {ics_url(event)}
""",
                button=("See the program", program_url(event)),
                pictures=[_picture(event)],
            )
        log.info("Change notice for %s sent to %d member(s)", event_id, len(members))
    finally:
        db.close()


def send_waitlist_decision(event_id: uuid.UUID, user_id: uuid.UUID, approved: bool) -> None:
    """Tell a member the organizer let them in off the waitlist, or couldn't.

    Background task, own session, like the change notice.
    """
    db = SessionLocal()
    try:
        event = (
            db.query(Event)
            .options(joinedload(Event.host))
            .filter(Event.id == event_id, Event.deleted_at.is_(None))
            .first()
        )
        user = db.get(User, user_id)
        if not event or not user or user.deleted_at is not None or not user.email:
            return
        if approved:
            subject = f"You're in: {event.title}"
            lead = "Good news — a place opened up and the organizer added you."
        else:
            subject = f"About {event.title}"
            lead = "The organizer wasn't able to fit you in to this program this time."
        mail.send(
            user.email,
            subject,
            f"""Hello {user.first_name},

{lead}

{event.title}
{when_text(event)}
{_where(event)}
""",
            button=("See the program", program_url(event)),
            pictures=[_picture(event)],
        )
    finally:
        db.close()


# ---------- sharing ----------


# The site's tag colours (frontend/tailwind.config.ts `tag-*`).
_TAG = {
    "free": ("Free", "#D0F9B9", "#265B08", None),
    "paid": ("Paid", "#C7DAFF", "#004BDE", None),
    "signup": ("Registration required", "#F1F1F1", mail.INK, mail.LINE),
}


def _pill(kind: str) -> str:
    label, bg, fg, edge = _TAG[kind]
    border = f"border:1px solid {edge};" if edge else ""
    return (
        f'<span style="display:inline-block;margin:6px 6px 0 0;padding:3px 10px;'
        f'border-radius:8px;{border}background:{bg};color:{fg};font-size:14px;'
        f'font-weight:500;line-height:1.4">{html.escape(label)}</span>'
    )


def _site_when(event: Event) -> tuple[str, str]:
    """The site's two lines, fixed for mail: "Monday · November 9, 2026" over
    "1:30PM - 3:00PM" (never "Tomorrow" — it's read later)."""
    if not event.starts_at:
        return "Date to be announced", ""
    start = event.starts_at.astimezone(TZ)
    day = start.strftime("%A · %B %-d, %Y")
    hours = start.strftime("%-I:%M%p")
    if event.ends_at:
        hours += " - " + event.ends_at.astimezone(TZ).strftime("%-I:%M%p")
    return day, hours


def site_card(event: Event) -> str:
    """One program as the site draws it in its list (member/CaregiverFeed):
    the picture, then the title with its Free / Paid and Registration
    required tags, when (the time in grey), where, the saved count — or
    "5/20 spots left" with a limit — and who posted it. The title and
    picture open the program."""
    url = html.escape(program_url(event), quote=True)
    tags = _pill("free" if event.is_free else "paid")
    if event.requires_signup:
        tags += _pill("signup")
    day, time = _site_when(event)
    going = event.saved_count
    if event.capacity is not None:
        count = (
            f'<span style="color:{mail.INK}">{max(event.capacity - going, 0)}/'
            f"{event.capacity}</span> spots left"
        )
    else:
        count = (
            f'<span style="color:{mail.INK}">{going}</span> '
            f'{"person" if going == 1 else "people"} saved this event'
        )
    fact = f'margin:10px 0 0;font-size:16px;line-height:1.45;color:{mail.INK}'
    muted = f'color:{mail.MUTED}'
    picture = html.escape(_picture(event), quote=True)
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
        f'style="margin:0 0 20px;border-collapse:separate;border:1px solid {mail.LINE};'
        'border-radius:8px;overflow:hidden">'
        f'<tr><td style="padding:0;line-height:0"><a href="{url}">'
        f'<img src="{picture}" alt="" width="542" style="display:block;width:100%;'
        'max-width:542px;height:auto;border:0"></a></td></tr>'
        '<tr><td style="padding:20px">'
        f'<p style="margin:0;font-size:22px;font-weight:500;line-height:1.3">'
        f'<a href="{url}" style="color:{mail.INK};text-decoration:none">'
        f"{html.escape(event.title)}</a></p>"
        f'<div style="margin-top:2px">{tags}</div>'
        f'<p style="{fact}">{html.escape(day)}'
        + (f'<br><span style="{muted}">{html.escape(time)}</span>' if time else "")
        + "</p>"
        f'<p style="{fact}">{html.escape(_where(event))}</p>'
        f'<p style="{fact};{muted}">{count}</p>'
        f'<p style="margin:14px 0 0;font-size:15px;line-height:1.4;{muted}">'
        f'Posted by <strong style="color:{mail.INK};font-weight:500">'
        f"{html.escape(event.host_name)}</strong></p>"
        "</td></tr></table>"
    )


def send_share(
    sender: User, to: str, events: list[Event], list_url: str | None
) -> bool:
    """A member's programs, mailed to someone they chose.

    From the site's address under the member's name, with replies going to
    the member when they have an email. One program gets "See the program";
    a list gets its live page when there is one, else the feed.
    """
    # Names from before sign-up capped them could be any length; the From
    # name and subject only ever carry a name's worth.
    name = " ".join(sender.first_name.split())[:NAME_MAX] or "A member"
    if len(events) == 1:
        intro = f"{name} thought you might like this program on {mail.BRAND}."
        subject = f"{name} shared {events[0].title}"
        button = ("See the program", program_url(events[0]))
    else:
        intro = f"{name} shared {len(events)} programs from {mail.BRAND} with you."
        subject = f"{name} shared {len(events)} programs with you"
        button = (
            ("See the full list", list_url)
            if list_url
            else ("Browse programs", settings.FRONTEND_ORIGIN)
        )
    lines = ["Hi,", "", intro]
    for event in events:
        lines += _program_lines(event)
    return mail.send(
        to,
        subject,
        "\n".join(lines) + "\n",
        button=button,
        pictures=[_picture(e) for e in events],
        from_name=f"{name} via {mail.BRAND}",
        reply_to=sender.email,
        # The site's own cards, not the plain reminder card.
        cards=[site_card(e) for e in events],
    )
