import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_host, get_db, require_admin
from app.api.routes.invites import email_taken
from app.core.org_space import org_by_slug, unique_slug
from app.core.security import hash_password
from app.models.access import AccessGroup
from app.models.event import Event
from app.models.host import Host, org_id_of
from app.schemas.host import (
    HostCreate,
    HostMeOut,
    HostOut,
    HostSelfUpdate,
    HostUpdate,
    HostWithCountsOut,
)

router = APIRouter(prefix="/hosts", tags=["hosts"])


def _org_of(host: Host) -> Host:
    """The organization row a login acts for (itself, for a shared login)."""
    return host.org if host.org_id is not None else host


def _me_out(host: Host) -> HostMeOut:
    org = _org_of(host)
    return HostMeOut(
        id=host.id,
        name=host.name,
        email=host.email,
        is_admin=host.is_superadmin,
        logo_url=org.logo_url,
        org_id=host.org_id,
        created_at=host.created_at,
        is_staff=host.is_staff,
        org=HostOut.model_validate(org),
    )


@router.get("/me", response_model=HostMeOut)
def get_me(host: Host = Depends(get_current_host)):
    """The signed-in person and the organization they act for."""
    return _me_out(host)


@router.patch("/me", response_model=HostMeOut)
def update_me(
    body: HostSelfUpdate,
    host: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    """Change your own organization's logo.

    Every account can do this for itself. Setting a logo used to be a superadmin
    errand, which meant an agency that rebranded had to ask KW Hab to upload a
    file for them — for the one thing on the platform that is unambiguously
    theirs, and the thing members use to recognise them in the feed.

    An empty string clears it, and the stepper falls back to initials. A staff
    login changes the organization's logo, not something of its own.
    """
    org = _org_of(host)
    fields = body.model_dump(exclude_unset=True)
    if "logo_url" in fields:
        org.logo_url = (fields["logo_url"] or "").strip() or None
    db.commit()
    db.refresh(host)
    return _me_out(host)


def _staff_of(db: Session, org_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[Host]]:
    """Live staff logins per organization, in one query."""
    if not org_ids:
        return {}
    rows = (
        db.query(Host)
        .filter(Host.org_id.in_(org_ids), Host.deleted_at.is_(None))
        .order_by(Host.created_at.asc())
        .all()
    )
    out: dict[uuid.UUID, list[Host]] = {}
    for row in rows:
        out.setdefault(row.org_id, []).append(row)
    return out


# ---------- Superadmin-only account management ----------
#
# Two tiers, both stored on `hosts`:
#   • admin       (is_admin=False) — manages only its own programs
#   • superadmin  (is_admin=True)  — manages any program, plus these routes
# Everything below is superadmin-only.


def _event_counts(db: Session) -> dict[uuid.UUID, int]:
    """Live programs owned, per host, in one query (not one per row). Archived
    ones are excluded — this count warns a superadmin how much programming a
    removal will retire, and an already-archived program isn't part of that."""
    rows = (
        db.query(Event.host_id, func.count(Event.id))
        .filter(Event.deleted_at.is_(None))
        .group_by(Event.host_id)
        .all()
    )
    return {host_id: count for host_id, count in rows}


def _superadmin_count(db: Session) -> int:
    """Live superadmin organizations. Counting archived ones would let the
    guard below wave through the removal of the last person who can still
    sign in; staff rows don't count because their tier is their org's."""
    return (
        db.query(func.count(Host.id))
        .filter(
            Host.is_admin.is_(True), Host.deleted_at.is_(None), Host.org_id.is_(None)
        )
        .scalar()
        or 0
    )


@router.get("", response_model=list[HostWithCountsOut])
def list_hosts(_: Host = Depends(require_admin), db: Session = Depends(get_db)):
    """Every live organization, each with its staff logins under it."""
    counts = _event_counts(db)
    orgs = (
        db.query(Host)
        .filter(Host.deleted_at.is_(None), Host.org_id.is_(None))
        .order_by(Host.created_at.asc())
        .all()
    )
    staff = _staff_of(db, [o.id for o in orgs])
    return [
        HostWithCountsOut(
            id=h.id,
            name=h.name,
            email=h.email,
            is_admin=h.is_admin,
            logo_url=h.logo_url,
            slug=h.slug,
            in_shared_feed=h.in_shared_feed,
            created_at=h.created_at,
            event_count=counts.get(h.id, 0),
            staff=[HostOut.model_validate(s) for s in staff.get(h.id, [])],
        )
        for h in orgs
    ]


@router.post("", response_model=HostOut, status_code=status.HTTP_201_CREATED)
def create_host(
    body: HostCreate,
    current: Host = Depends(require_admin),
    db: Session = Depends(get_db),
):
    email = body.email.strip().lower()
    # Live accounts only — an archived one releases its address (see the
    # uq_hosts_email_live partial index), so an agency can be set up again.
    # Same message as an invitation's, naming the login it belongs to.
    reason = email_taken(db, email, current)
    if reason:
        raise HTTPException(status.HTTP_409_CONFLICT, reason)
    host = Host(
        name=body.name,  # already trimmed and non-blank by the schema
        email=email,
        password_hash=hash_password(body.password),
        is_admin=body.is_admin,
        logo_url=body.logo_url,
        slug=unique_slug(db, body.name),
        in_shared_feed=body.in_shared_feed,
    )
    db.add(host)
    try:
        db.commit()
    except IntegrityError:
        # Race with a concurrent create for the same email.
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            email_taken(db, email, current) or "That email already has an account.",
        )
    db.refresh(host)
    return host


@router.patch("/{host_id}", response_model=HostOut)
def update_host(
    host_id: uuid.UUID,
    body: HostUpdate,
    current: Host = Depends(require_admin),
    db: Session = Depends(get_db),
):
    host = db.get(Host, host_id)
    if not host or host.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Admin not found")

    # Every field is optional, and an explicit null means "leave it alone" just
    # like omitting it — dropping them here keeps `is_admin: null` from being
    # written to a NOT NULL column further down.
    fields = {
        k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None
    }

    if "is_admin" in fields and fields["is_admin"] != host.is_admin:
        # A staff login has no tier of its own — change the organization's.
        if host.org_id is not None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Staff logins take their organization's access level.",
            )
        # Dropping your own superadmin rights locks you out of this very page,
        # with no way back in short of another superadmin noticing. "Your own"
        # includes your organization's, when you're signed in as its staff.
        if host.id in (current.id, org_id_of(current)):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "You can't change your own access level.",
            )
        # Backstop only. Within a single request this can't fire: the caller is
        # a superadmin and can't be the target (guarded above), so a superadmin
        # target means at least two exist. It's here to narrow the window on
        # two superadmins concurrently demoting each other.
        if not fields["is_admin"] and _superadmin_count(db) <= 1:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "This is the last superadmin — promote someone else first.",
            )

    if fields.get("password"):
        host.password_hash = hash_password(fields["password"])
    if fields.get("name"):
        host.name = fields["name"]  # already trimmed and non-blank by the schema
    if "is_admin" in fields:
        host.is_admin = fields["is_admin"]
    # Null means "leave it alone" here, per the rule above, so an empty string
    # is how a logo gets removed.
    if "logo_url" in fields:
        host.logo_url = fields["logo_url"] or None
    if "in_shared_feed" in fields and host.org_id is None:
        host.in_shared_feed = fields["in_shared_feed"]

    db.commit()
    db.refresh(host)
    return host


@router.delete("/{host_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_host(
    host_id: uuid.UUID,
    current: Host = Depends(require_admin),
    db: Session = Depends(get_db),
):
    host = db.get(Host, host_id)
    if not host or host.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Admin not found")
    # Your own login, or the organization your login belongs to — removing
    # either takes your own access with it.
    if host.id in (current.id, org_id_of(current)):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "You can't remove your own account."
        )
    # Same backstop as the demote path: unreachable in a single request, kept
    # to narrow the window on concurrent removals.
    if host.is_admin and host.org_id is None and _superadmin_count(db) <= 1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This is the last superadmin — promote someone else first.",
        )

    # Archive both the account and its programming, rather than deleting the
    # row. Host.events cascades delete-orphan, so db.delete(host) would destroy
    # every program this agency ever published — including ones members have
    # saved and attendance the agency reports to funders.
    #
    # The programs stay attributed to the agency that ran them. They used to be
    # reassigned to whichever superadmin pressed the button, which kept them
    # visible but filed KW Hab's name on another agency's work, and left the
    # acting superadmin owning programs they had never seen. Retiring the
    # organizer retires their programming with them; the rows, the counts and
    # the attribution all survive.
    #
    # A staff login owns nothing, so for one of those only the last line does
    # anything. Its organization's staff logins go with the organization: a
    # person can't act for an agency that has left.
    now = datetime.now(timezone.utc)
    db.query(Event).filter(
        Event.host_id == host.id, Event.deleted_at.is_(None)
    ).update({Event.deleted_at: now}, synchronize_session=False)
    db.query(AccessGroup).filter(
        AccessGroup.host_id == host.id, AccessGroup.deleted_at.is_(None)
    ).update({AccessGroup.deleted_at: now}, synchronize_session=False)
    db.query(Host).filter(
        Host.org_id == host.id, Host.deleted_at.is_(None)
    ).update({Host.deleted_at: now}, synchronize_session=False)
    host.deleted_at = now
    db.commit()


@router.get("/spaces/{slug}")
def org_space(slug: str, db: Session = Depends(get_db)):
    """Public: the organization behind /o/{slug} — what its space shows at the
    top. 404 for an unknown or archived organization."""
    org = org_by_slug(db, slug)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such organization")
    return {"name": org.name, "slug": org.slug, "logo_url": org.logo_url}
