"""Mail to members: the day-before reminder and the change notice.

Only members who added an email get either — an icon account has no address
unless its owner chose to give one. Both mails describe the program in
America/Toronto, where it happens, whatever zone the reader is in.
"""

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
            )
        log.info("Change notice for %s sent to %d member(s)", event_id, len(members))
    finally:
        db.close()
