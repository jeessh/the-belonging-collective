"""Spot holds: saving a program with a capacity keeps a place for one hour.

The hold is the only thing capacity gates. Saving never fails for capacity —
past the hour, or when the holds are already at capacity, the program is
simply saved without one. `spots_left` counts the holds still running.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.attendance import SAVED, Attendance
from app.models.event import Event
from app.schemas.event import EventOut

HOLD = timedelta(hours=1)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def active_until(a: Attendance, now: datetime) -> datetime | None:
    """When this row's hold runs out, if it is still running; else None.

    The one definition of "held": saved, with an expiry still ahead of `now`.
    """
    if a.status == SAVED and a.held_until is not None and a.held_until > now:
        return a.held_until
    return None


def take_hold(db: Session, event: Event, now: datetime) -> datetime | None:
    """A new hold's expiry if there is a spot to hold, else None.

    Locks the event row so two members reading "one left" can't both take it —
    the same lock the old capacity gate used. Runs inside the caller's
    transaction; the lock is released by its commit.
    """
    if event.capacity is None:
        return None
    locked = (
        db.query(Event)
        .filter(Event.id == event.id, Event.deleted_at.is_(None))
        .with_for_update()
        .one_or_none()
    )
    # Archived between the caller's read and the lock: the save still goes
    # through (the row is what the caller checked), but nothing to hold.
    if locked is None or locked.capacity is None:
        return None
    held = (
        db.query(func.count(Attendance.user_id))
        .filter(
            Attendance.event_id == event.id,
            Attendance.status == SAVED,
            Attendance.held_until > now,
        )
        .scalar()
        or 0
    )
    return now + HOLD if held < locked.capacity else None


def annotate(rows: list[Event], out: list[EventOut], viewer_id: uuid.UUID | None) -> None:
    """Fill `spots_left` and the viewer's own `held_until` from the eager-loaded
    attendees, so the feed pays no query per row for either."""
    now = now_utc()
    for row, item in zip(rows, out):
        if row.capacity is not None:
            active = sum(1 for a in row.attendees if active_until(a, now))
            item.spots_left = max(row.capacity - active, 0)
        if viewer_id is not None:
            mine = next((a for a in row.attendees if a.user_id == viewer_id), None)
            if mine is not None:
                item.held_until = active_until(mine, now)
