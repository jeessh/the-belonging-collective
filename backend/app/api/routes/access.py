"""Special-access groups: a member asks, the organization answers.

Access is per group, not per event, so one approval covers the group's future
programs too. The agency already knows who belongs; this only carries the
request and the decision. Nothing here is deleted — groups are archived and
memberships move between statuses.
"""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_host, get_current_user, get_db
from app.core.rate_limit import client_key, enforce, record
from app.models.access import (
    APPROVED,
    DECLINED,
    REQUESTED,
    REVOKED,
    STATUSES,
    AccessGroup,
    AccessMembership,
)
from app.models.event import Event
from app.models.host import Host
from app.models.user import User
from app.schemas.access import (
    AccessGroupIn,
    AccessGroupOut,
    AccessGroupRename,
    AccessMemberOut,
    AccessRequestIn,
    MembershipOut,
)

router = APIRouter(prefix="/access-groups", tags=["access"])

# Requests per member per window. A member has no reason to ask more than a
# handful of times; a script has every reason to, since each request lands in
# an admin's queue. Counted per member, not per address — see rate_limit.py on
# why shared facilities make address limits the wrong tool for members.
REQUEST_LIMIT = 20

_DECISION_STATUS = {"approve": APPROVED, "decline": DECLINED, "revoke": REVOKED}


def _live_group(db: Session, group_id: uuid.UUID) -> AccessGroup:
    group = db.get(AccessGroup, group_id)
    if not group or group.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Access group not found")
    return group


def _managed_group(db: Session, group_id: uuid.UUID, host: Host) -> AccessGroup:
    """The group, provided this organizer may manage it: its owner, or a
    superadmin. Other agencies' groups are a 403, not a 404 — they exist,
    they're just not yours."""
    group = _live_group(db, group_id)
    if not host.is_admin and group.host_id != host.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your access group")
    return group


# ---------- member side ----------


@router.post("/{group_id}/request", response_model=MembershipOut)
def request_access(
    group_id: uuid.UUID,
    body: AccessRequestIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """A member asks to join a group, usually from a restricted program's page.

    Idempotent while the request is open or already granted. A declined or
    revoked member gets a 409 rather than a fresh request: the organization
    made a decision, and re-asking every hour is not how it gets changed —
    the admin can still approve them from the console.
    """
    group = _live_group(db, group_id)
    key = f"access:{user.id}"
    enforce(db, {key: REQUEST_LIMIT})
    record(db, key)

    if body.event_id is not None:
        event = db.get(Event, body.event_id)
        if not event or event.deleted_at is not None or event.access_group_id != group.id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "That program is not in this access group."
            )

    membership = db.get(AccessMembership, {"user_id": user.id, "group_id": group.id})
    if membership is None:
        membership = AccessMembership(
            user_id=user.id,
            group_id=group.id,
            status=REQUESTED,
            requested_via_event_id=body.event_id,
        )
        db.add(membership)
        try:
            db.commit()
        except IntegrityError:
            # Lost a race with the same member's double-click; the row exists.
            db.rollback()
            membership = db.get(
                AccessMembership, {"user_id": user.id, "group_id": group.id}
            )
        db.refresh(membership)
        return membership
    if membership.status in (DECLINED, REVOKED):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The organization has already decided on your access. Please "
            "contact them directly if you think that should change.",
        )
    return membership


# ---------- organizer side ----------


@router.get("", response_model=list[AccessGroupOut])
def list_groups(host: Host = Depends(get_current_host), db: Session = Depends(get_db)):
    """The organizer's own groups (every group, for a superadmin), each with
    how many requests are waiting and how many members are in."""
    # Live members only, the same rows the members list shows.
    counts = (
        select(
            AccessMembership.group_id,
            func.count(case((AccessMembership.status == REQUESTED, 1))).label("pending"),
            func.count(case((AccessMembership.status == APPROVED, 1))).label("approved"),
        )
        .join(User, User.id == AccessMembership.user_id)
        .where(User.deleted_at.is_(None))
        .group_by(AccessMembership.group_id)
        .subquery()
    )
    q = (
        db.query(
            AccessGroup,
            func.coalesce(counts.c.pending, 0),
            func.coalesce(counts.c.approved, 0),
        )
        .outerjoin(counts, counts.c.group_id == AccessGroup.id)
        .options(joinedload(AccessGroup.host))
        .filter(AccessGroup.deleted_at.is_(None))
        .order_by(AccessGroup.name.asc())
    )
    if not host.is_admin:
        q = q.filter(AccessGroup.host_id == host.id)
    return [
        AccessGroupOut(
            id=group.id,
            host_id=group.host_id,
            host_name=group.host.name if group.host else "",
            name=group.name,
            created_at=group.created_at,
            pending_count=pending_count,
            approved_count=approved_count,
        )
        for group, pending_count, approved_count in q.all()
    ]


@router.post("", response_model=AccessGroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    body: AccessGroupIn,
    host: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    owner_id = host.id
    if body.host_id is not None and body.host_id != host.id:
        if not host.is_admin:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "You can only create groups for your own organization."
            )
        owner = db.get(Host, body.host_id)
        if not owner or owner.deleted_at is not None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
        owner_id = owner.id
    group = AccessGroup(host_id=owner_id, name=body.name.strip())
    db.add(group)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This organization already has a group with that name."
        )
    db.refresh(group)
    return AccessGroupOut(
        id=group.id,
        host_id=group.host_id,
        host_name=group.host.name if group.host else "",
        name=group.name,
        created_at=group.created_at,
    )


@router.patch("/{group_id}", response_model=AccessGroupOut)
def rename_group(
    group_id: uuid.UUID,
    body: AccessGroupRename,
    host: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    group = _managed_group(db, group_id, host)
    group.name = body.name.strip()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This organization already has a group with that name."
        )
    db.refresh(group)
    # Counts are unchanged by a rename; the list route has them.
    return AccessGroupOut(
        id=group.id,
        host_id=group.host_id,
        host_name=group.host.name if group.host else "",
        name=group.name,
        created_at=group.created_at,
    )


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_group(
    group_id: uuid.UUID,
    host: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    """Archive the group. Refused while live programs still restrict access
    to it — archiving would silently make them either public or unreachable,
    and neither is a decision to make by accident."""
    group = _managed_group(db, group_id, host)
    in_use = (
        db.query(func.count(Event.id))
        .filter(Event.access_group_id == group.id, Event.deleted_at.is_(None))
        .scalar()
    )
    if in_use:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{in_use} live program(s) still use this group. Move or archive them first.",
        )
    group.deleted_at = func.now()
    db.commit()


@router.get("/{group_id}/members", response_model=list[AccessMemberOut])
def list_members(
    group_id: uuid.UUID,
    status_: str | None = Query(None, alias="status"),
    host: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    group = _managed_group(db, group_id, host)
    if status_ is not None and status_ not in STATUSES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"status must be one of {sorted(STATUSES)}"
        )
    q = (
        db.query(AccessMembership)
        .join(User, User.id == AccessMembership.user_id)
        .options(
            joinedload(AccessMembership.user),
            joinedload(AccessMembership.requested_via),
        )
        .filter(AccessMembership.group_id == group.id, User.deleted_at.is_(None))
        .order_by(AccessMembership.requested_at.desc())
    )
    if status_ is not None:
        q = q.filter(AccessMembership.status == status_)
    return [
        AccessMemberOut(
            user_id=m.user_id,
            first_name=m.user.first_name,
            last_name=m.user.last_name,
            email=m.user.email,
            status=m.status,
            requested_at=m.requested_at,
            decided_at=m.decided_at,
            requested_via=m.requested_via,
        )
        for m in q.all()
    ]


@router.post(
    "/{group_id}/members/{user_id}/{decision}", response_model=AccessMemberOut
)
def decide_membership(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    decision: Literal["approve", "decline", "revoke"],
    host: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    """Approve, decline or revoke. Any status may move to any other — a
    declined member can be approved later, an approved one revoked — and the
    row records who decided and when."""
    group = _managed_group(db, group_id, host)
    membership = (
        db.query(AccessMembership)
        .options(
            joinedload(AccessMembership.user), joinedload(AccessMembership.requested_via)
        )
        .filter(
            AccessMembership.group_id == group.id, AccessMembership.user_id == user_id
        )
        .first()
    )
    if not membership or membership.user.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No request from that member")
    membership.status = _DECISION_STATUS[decision]
    membership.decided_at = func.now()
    membership.decided_by_host_id = host.id
    db.commit()
    db.refresh(membership)
    return AccessMemberOut(
        user_id=membership.user_id,
        first_name=membership.user.first_name,
        last_name=membership.user.last_name,
        email=membership.user.email,
        status=membership.status,
        requested_at=membership.requested_at,
        decided_at=membership.decided_at,
        requested_via=membership.requested_via,
    )
