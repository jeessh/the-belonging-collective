import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    Response,
    status,
)
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_current_user, get_db, get_optional_user
from app.core import gcal, holds, ical
from app.core.access import is_approved, visible_to_member
from app.core.rate_limit import CLICK_LIMIT, client_key, enforce, record
from app.core.pricing import covers_whole_series
from app.models.attendance import REMOVED, SAVED, Attendance
from app.models.click import RegistrationClick
from app.models.event import Event
from app.models.user import User
from app.schemas.event import EventOut

router = APIRouter(tags=["attendance"])

# How recently a calendar must have fetched the feed to count as subscribed.
FEED_SUBSCRIBED_FOR = timedelta(days=3)


@router.post(
    "/events/{event_id}/registration-click",
    status_code=status.HTTP_204_NO_CONTENT,
)
def record_registration_click(
    event_id: uuid.UUID,
    request: Request,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """A member followed this program's outbound registration link.

    Public: the event page is public, and a click is worth counting whether or
    not we know who made it. When registration lives on the agency's own site
    this is the last observable step, so it stands in for "signed up" in the
    adoption numbers nonprofits report.
    """
    event = db.get(Event, event_id)
    if not event or event.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    ip_key = f"{client_key(request)}:clicks"
    enforce(db, {ip_key: CLICK_LIMIT})
    record(db, ip_key)
    db.add(
        RegistrationClick(event_id=event_id, user_id=user.id if user else None)
    )
    db.commit()


def save_event(db: Session, user: User, event_id: uuid.UUID) -> dict:
    """Save the program for `user` — a bookmark, never a registration.

    The one implementation behind a member saving for themselves and a
    caregiver saving for them (routes/care.py): the row is the member's, and
    so are the rules — special access is the member's approval, the hold is
    the member's spot.

    Capacity never refuses a save. What it does is hold a spot for the first
    hour (core/holds.py) when the holds still running are under capacity;
    `held_until` in the response says whether this save got one.
    """
    event = db.get(Event, event_id)
    if not event or event.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    # The page opens for anyone with the link; saving is what needs approval.
    if event.access_group_id and not is_approved(db, user.id, event.access_group_id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only members with special access can save this program. Ask for "
            "access on the program page first.",
        )
    now = holds.now_utc()
    existing = db.get(Attendance, {"user_id": user.id, "event_id": event_id})
    if existing:
        # A previously un-saved row is re-saved in place rather than recreated —
        # the row never went away, so an insert here would just hit the PK.
        if existing.status == SAVED:
            return {
                "ok": True,
                "already": True,
                "held_until": holds.active_until(existing, now),
            }
        existing.status = SAVED
        existing.held_until = holds.take_hold(db, event, now)
        db.commit()
        return {"ok": True, "held_until": existing.held_until}
    # A series price covers the whole run, so saving one date enrols them in
    # all of them. Making somebody who paid for eight weeks save eight dates by
    # hand is busywork that also loses what they actually bought.
    targets = [event]
    if covers_whole_series(event.pricing_model) and event.series_id:
        run = (
            db.query(Event)
            .filter(
                Event.series_id == event.series_id,
                Event.deleted_at.is_(None),
                # From this date forward. Joining an eight-week course in week
                # three buys the remaining weeks, not the ones already run.
                Event.starts_at >= event.starts_at,
            )
            .order_by(Event.starts_at.asc(), Event.id.asc())
            .all()
            if event.starts_at
            else [event]
        )
        # Only as many dates as they paid for. A series can be posted further
        # ahead than one payment covers — the sheet has an 8-session price on a
        # program running 16 weeks — and enrolling them in all of it would take
        # places in dates nobody bought.
        limit = event.price_sessions or len(run)
        targets = run[:limit]

    held_until = None
    for target in targets:
        held = holds.take_hold(db, target, now)
        if target.id == event.id:
            held_until = held
        existing = db.get(
            Attendance, {"user_id": user.id, "event_id": target.id}
        )
        if existing:
            existing.status = SAVED
            existing.held_until = held
        else:
            db.add(
                Attendance(
                    user_id=user.id, event_id=target.id, status=SAVED, held_until=held
                )
            )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # Unique violation (23505) = lost a race with a concurrent attend:
        # same outcome as the pre-check, stay idempotent. An FK violation
        # means the event was deleted mid-request: no attendance exists.
        if getattr(exc.orig, "sqlstate", None) == "23505":
            return {"ok": True, "already": True, "held_until": None}
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return {"ok": True, "held_until": held_until}


@router.post("/events/{event_id}/attend", status_code=status.HTTP_201_CREATED)
def attend_event(
    event_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = save_event(db, user, event_id)
    gcal.after_save(background, user)
    return result


def unsave_event(db: Session, user: User, event_id: uuid.UUID) -> None:
    """Un-saving flips the status; the row stays so the organizer's cumulative
    save count doesn't walk backwards. Any hold goes with it."""
    existing = db.get(Attendance, {"user_id": user.id, "event_id": event_id})
    if not existing or existing.status == REMOVED:
        return
    event = db.get(Event, event_id)
    # Released the same way it was taken: if one save enrolled them in the whole
    # run, one removal has to let them out of it, or they're stuck holding
    # places they can't give back.
    if event and covers_whole_series(event.pricing_model) and event.series_id:
        db.query(Attendance).filter(
            Attendance.user_id == user.id,
            Attendance.event_id.in_(
                db.query(Event.id).filter(Event.series_id == event.series_id)
            ),
        ).update(
            {Attendance.status: REMOVED, Attendance.held_until: None},
            synchronize_session=False,
        )
    else:
        existing.status = REMOVED
        existing.held_until = None
    db.commit()


@router.delete(
    "/events/{event_id}/attend", status_code=status.HTTP_204_NO_CONTENT
)
def unattend_event(
    event_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    unsave_event(db, user, event_id)
    gcal.after_save(background, user)


def saved_events(db: Session, user: User) -> list[Event]:
    # One query with eager loads; iterating user.attending lazy-loads each
    # event (and then its host/images) row by row.
    return (
        db.query(Event)
        .join(Attendance, Attendance.event_id == Event.id)
        .filter(
            Attendance.user_id == user.id,
            Attendance.status == SAVED,
            Event.deleted_at.is_(None),
            # A revoked member's saves stay on the row (the count survives)
            # but leave their list, the same way an archived program does.
            visible_to_member(user.id),
        )
        # attendees included: EventOut.saved_count reads it, and without this
        # every saved program costs an extra query on each member page load.
        .options(
            joinedload(Event.host),
            joinedload(Event.access_group),
            selectinload(Event.images),
            selectinload(Event.attendees),
        )
        .order_by(Event.starts_at.asc().nullslast(), Event.id.asc())
        .all()
    )


@router.get("/users/me/events", response_model=list[EventOut])
def my_events(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    rows = saved_events(db, user)
    out = [EventOut.model_validate(row) for row in rows]
    holds.annotate(rows, out, user.id)
    return out


# ---------- shareable saved list ----------


@router.post("/users/me/share-link")
def share_link(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """The member's public list handle — made on first ask, the same one after."""
    if not user.share_token:
        user.share_token = secrets.token_urlsafe(24)
        db.commit()
    return {"token": user.share_token}


class SharedListOut(BaseModel):
    first_name: str
    events: list[EventOut]


def _shared_owner(db: Session, token: str) -> User:
    user = (
        db.query(User)
        .filter(User.share_token == token, User.deleted_at.is_(None))
        .first()
    )
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such list")
    return user


def _shared_events(db: Session, user: User):
    """The saved programs a share link shows: live and public only. Special
    access has its own gate, so those are left out whoever is looking."""
    return (
        db.query(Event)
        .join(Attendance, Attendance.event_id == Event.id)
        .filter(
            Attendance.user_id == user.id,
            Attendance.status == SAVED,
            Event.deleted_at.is_(None),
            Event.access_group_id.is_(None),
        )
    )


@router.get("/shared/{token}", response_model=SharedListOut)
def shared_list(token: str, db: Session = Depends(get_db)):
    """A member's upcoming saved programs, for anyone with the link.

    The list has no gate — it is only a list. "N going" is withheld the same
    way the public event routes withhold it from anonymous viewers.
    """
    user = _shared_owner(db, token)
    now = holds.now_utc()
    rows = (
        _shared_events(db, user)
        .filter(
            # Upcoming, measured from the end as lib/time.isUpcoming does;
            # undated programs haven't happened yet either.
            or_(
                Event.starts_at.is_(None),
                func.coalesce(Event.ends_at, Event.starts_at) >= now,
            ),
        )
        .options(
            joinedload(Event.host),
            selectinload(Event.images),
            selectinload(Event.attendees),
        )
        .order_by(Event.starts_at.asc().nullslast(), Event.id.asc())
        .all()
    )
    out = [EventOut.model_validate(row) for row in rows]
    holds.annotate(rows, out, None)
    for item in out:
        item.saved_count = None
    return SharedListOut(first_name=user.first_name, events=out)


# ---------- calendar feed ----------


@router.post("/users/me/calendar-feed")
def calendar_feed(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """The member's private calendar handle — made on first ask, the same one
    after, so a calendar subscribed once keeps working.

    `subscribed` says a calendar app has fetched the feed lately. The button
    then opens Google Calendar rather than Google's "Add calendar" page, which
    would list the same calendar a second time. Google re-fetches a subscribed
    feed at least daily, so a few quiet days means they removed it.
    """
    if not user.calendar_token:
        user.calendar_token = secrets.token_urlsafe(24)
        db.commit()
    fetched = user.calendar_feed_fetched_at
    subscribed = bool(
        fetched and datetime.now(timezone.utc) - fetched < FEED_SUBSCRIBED_FOR
    )
    return {"token": user.calendar_token, "subscribed": subscribed}


@router.get("/calendar/{token}.ics")
def calendar_feed_ics(token: str, db: Session = Depends(get_db)):
    """The member's saved list as a feed a calendar app subscribes to, so
    every save lands in their calendar and an un-save leaves it. Google
    fetches it from its own servers without the member's cookie, so the token
    is the key. Unlike the share link it is the whole list, special access
    included: it only goes to the member's own calendar. Past dates stay in,
    so the calendar keeps last week."""
    user = (
        db.query(User)
        .filter(User.calendar_token == token, User.deleted_at.is_(None))
        .first()
    )
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such calendar")
    # Stamped at most hourly: it's what tells the button this feed is already
    # in their calendar.
    now = datetime.now(timezone.utc)
    fetched = user.calendar_feed_fetched_at
    if not fetched or now - fetched > timedelta(hours=1):
        user.calendar_feed_fetched_at = now
        db.commit()
    # Connected, the app's own calendar carries the list (core/gcal.py). A feed
    # subscribed before that goes quiet rather than showing every program twice.
    events = [] if user.google_calendar == "connected" else saved_events(db, user)
    return Response(
        ical.build(
            events,
            name=f"{user.first_name}'s programs · The Belonging Collective",
        ),
        media_type="text/calendar; charset=utf-8",
    )


@router.get("/users/me/events/calendar.ics")
def my_events_calendar(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Every dated program the member has saved, as one calendar file."""
    return Response(
        ical.build(saved_events(db, user)),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="saved-programs.ics"'},
    )
