"""Who may see and save a special-access program. The one place the rule lives.

Lists (the feed, the saved list) are scoped here; the by-id routes are not,
because a program's link or QR code has to open for whoever holds it — they
just can't save it until they're approved.
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.access import APPROVED, AccessGroup, AccessMembership
from app.models.event import Event
from app.models.host import Host, org_id_of
from app.models.user import User

# What EventOut.access_status says when there is no membership row.
NONE = "none"


def approved_group_ids(user_id: uuid.UUID):
    """Subquery: the groups this member is currently approved into."""
    return select(AccessMembership.group_id).where(
        AccessMembership.user_id == user_id,
        AccessMembership.status == APPROVED,
    )


def visible_to_member(user_id: uuid.UUID):
    """Filter: public, or in a group the member is approved into."""
    return or_(
        Event.access_group_id.is_(None),
        Event.access_group_id.in_(approved_group_ids(user_id)),
    )


def scope_to_viewer(query, viewer: User | None, organizer: Host | None):
    """Narrow an Event query to what this caller may list.

    Anonymous: public only. Member: public plus their approved groups.
    Organizer: public plus their own organization's restricted programs;
    a superadmin sees everything, since they manage every program.
    """
    if organizer is not None:
        if organizer.is_superadmin:
            return query
        return query.filter(
            or_(Event.access_group_id.is_(None), Event.host_id == org_id_of(organizer))
        )
    if viewer is not None:
        return query.filter(visible_to_member(viewer.id))
    return query.filter(Event.access_group_id.is_(None))


def membership_statuses(
    db: Session, user_id: uuid.UUID, group_ids: set[uuid.UUID]
) -> dict[uuid.UUID, str]:
    """One query for this member's status in each of the given groups."""
    if not group_ids:
        return {}
    rows = db.execute(
        select(AccessMembership.group_id, AccessMembership.status).where(
            AccessMembership.user_id == user_id,
            AccessMembership.group_id.in_(group_ids),
        )
    ).all()
    return {group_id: status_ for group_id, status_ in rows}


def is_approved(db: Session, user_id: uuid.UUID, group_id: uuid.UUID) -> bool:
    return membership_statuses(db, user_id, {group_id}).get(group_id) == APPROVED


def resolve_group_for_host(
    db: Session, group_id: uuid.UUID | None, host_id: uuid.UUID
) -> AccessGroup | None:
    """The live group an event may be filed under, or a 400.

    The group must belong to the event's own organization — including when a
    superadmin edits another agency's program, since filing KW Hab's residents
    under Karis's event would be a mistake, not a privilege.
    """
    if group_id is None:
        return None
    group = db.get(AccessGroup, group_id)
    if not group or group.deleted_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That access group no longer exists.")
    if group.host_id != host_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "That access group belongs to another organization.",
        )
    return group
