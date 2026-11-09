"""The cap on superadmins: at most MAX_SUPERADMINS organizations may hold
the tier, counting invitations to it that are still waiting (an invite is a
seat promised). Checked wherever the tier can be given — an organization
created or promoted by a superadmin, a superadmin invitation sent, and one
accepted (the seat may have gone since it was sent).
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.host import Host
from app.models.invite import HostInvite

MAX_SUPERADMINS = 5

FULL = (
    f"There can be at most {MAX_SUPERADMINS} superadmins. Remove one (or "
    "withdraw a waiting invitation) first."
)


def live_count(db: Session) -> int:
    """Live superadmin organizations (staff rows take their org's tier)."""
    return (
        db.query(func.count(Host.id))
        .filter(Host.is_admin.is_(True), Host.deleted_at.is_(None), Host.org_id.is_(None))
        .scalar()
        or 0
    )


def pending_count(db: Session) -> int:
    """Superadmin invitations still waiting to be accepted."""
    return (
        db.query(func.count(HostInvite.id))
        .filter(
            HostInvite.is_admin.is_(True),
            HostInvite.org_id.is_(None),
            HostInvite.accepted_at.is_(None),
            HostInvite.expires_at > datetime.now(timezone.utc),
        )
        .scalar()
        or 0
    )


def require_seat(db: Session, *, counting_invites: bool = True) -> None:
    """409 when giving out one more superadmin seat would pass the cap."""
    taken = live_count(db) + (pending_count(db) if counting_invites else 0)
    if taken >= MAX_SUPERADMINS:
        raise HTTPException(status.HTTP_409_CONFLICT, FULL)
