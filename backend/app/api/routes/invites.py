import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_host, get_db, require_admin, set_auth_cookie
from app.core.config import settings
from app.core.mail import send as send_mail
from app.core.rate_limit import IP_LIMIT, client_key, enforce, record
from app.core.security import (
    PASSWORD_MIN_LENGTH,
    create_access_token,
    credential_fingerprint,
    hash_password,
)
from app.models.host import Host, org_id_of
from app.models.invite import HostInvite

router = APIRouter(prefix="/invites", tags=["invites"])

INVITE_DAYS = 14


def _hash(token: str) -> str:
    """Tokens are long random strings, so a plain SHA-256 is right here — the
    slow hashing passwords need exists to survive guessing, and there is
    nothing to guess in 32 bytes of entropy."""
    return hashlib.sha256(token.encode()).hexdigest()


class InviteCreate(BaseModel):
    """Two kinds of invitation share this:

    • an organization (`org_id` null): `organization` names the new agency;
      superadmins only.
    • a staff login (`org_id` set): `name` is the person; the login joins that
      organization. Anyone signed in for the organization may send one — a
      superadmin for any organization.
    """

    organization: str | None = None
    name: str | None = None
    email: EmailStr
    is_admin: bool = False
    org_id: uuid.UUID | None = None


class InviteAccept(BaseModel):
    token: str
    password: str = Field(min_length=PASSWORD_MIN_LENGTH)


def _email_free(db: Session, email: str) -> None:
    # Live accounts only. An archived one has released its address, which is
    # what lets an agency that was removed be invited back under it.
    if (
        db.query(Host)
        .filter(Host.email == email, Host.deleted_at.is_(None))
        .first()
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "That email already has an account."
        )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_invite(
    body: InviteCreate,
    current: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    """Issue an invitation and mail the accept link to the invitee.

    Returns the token once as well — it isn't stored in the clear and can't
    be shown again — so the sender can pass the link on by hand if the mail
    doesn't arrive."""
    email = body.email.strip().lower()
    _email_free(db, email)

    if body.org_id is not None:
        # Staff invitation. Your own organization, or any for a superadmin.
        if body.org_id != org_id_of(current) and not current.is_superadmin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your organization")
        org = db.get(Host, body.org_id)
        if not org or org.deleted_at is not None or org.org_id is not None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
        name = (body.name or "").strip()
        if not name:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Name can't be blank")
        invite = HostInvite(
            token_hash="",
            organization=org.name,
            name=name,
            org_id=org.id,
            email=email,
            is_admin=False,
            invited_by=current.id,
        )
        intro = (
            f"{current.name} invited you to join {org.name}'s team on The "
            "Belonging Collective, where you can post and manage its programs."
        )
    else:
        # A new organization: superadmins only. There is no host signup route,
        # and this is the door that replaced it.
        if not current.is_superadmin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
        organization = (body.organization or "").strip()
        if not organization:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "Organization can't be blank"
            )
        invite = HostInvite(
            token_hash="",
            organization=organization,
            email=email,
            is_admin=body.is_admin,
            invited_by=current.id,
        )
        intro = (
            f"{current.name} invited {organization} to post programs on The "
            "Belonging Collective."
        )

    token = secrets.token_urlsafe(32)
    invite.token_hash = _hash(token)
    invite.expires_at = datetime.now(timezone.utc) + timedelta(days=INVITE_DAYS)
    db.add(invite)
    db.commit()
    db.refresh(invite)
    link = f"{settings.FRONTEND_ORIGIN}/host/invite/{token}"
    send_mail(
        email,
        "You're invited to The Belonging Collective",
        f"""Hello,

{intro}

Open this link to choose a password and get started. It stops working after {INVITE_DAYS} days:

{link}

If you weren't expecting this, you can ignore it.
""",
        button=("Accept the invitation", link),
    )
    return {
        "id": str(invite.id),
        "token": token,
        "organization": invite.organization,
        "name": invite.name,
        "org_id": str(invite.org_id) if invite.org_id else None,
        "email": invite.email,
        "expires_at": invite.expires_at,
    }


@router.get("")
def list_invites(
    _: Host = Depends(require_admin), db: Session = Depends(get_db)
):
    """Outstanding invitations to found an organization, so nobody is invited
    twice by accident. Staff invitations are listed with their team
    (GET /hosts/team)."""
    rows = (
        db.query(HostInvite)
        .filter(HostInvite.accepted_at.is_(None), HostInvite.org_id.is_(None))
        .order_by(HostInvite.created_at.desc())
        .all()
    )
    now = datetime.now(timezone.utc)
    return [
        {
            "id": str(r.id),
            "organization": r.organization,
            "email": r.email,
            "is_admin": r.is_admin,
            "expires_at": r.expires_at,
            "expired": r.expires_at < now,
        }
        for r in rows
    ]


@router.delete("/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invite(
    invite_id: uuid.UUID,
    current: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    """Withdraw an invitation: a superadmin any, anyone else only a staff
    invitation for their own organization."""
    invite = db.get(HostInvite, invite_id)
    if not invite or invite.accepted_at is not None:
        return
    if not current.is_superadmin and invite.org_id != org_id_of(current):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your invitation")
    db.delete(invite)
    db.commit()


@router.get("/{token}")
def preview_invite(token: str, db: Session = Depends(get_db)):
    """What the accept page shows before anyone types a password.

    Deliberately returns the organization and email so the invitee can see they
    were expected — an invitation that shows nothing is indistinguishable from
    a phishing link. `name` and `staff` say whether this is a person joining
    an existing team rather than a new organization.
    """
    invite = _usable(db, token)
    return {
        "organization": invite.organization,
        "email": invite.email,
        "name": invite.name,
        "staff": invite.org_id is not None,
    }


def _usable(db: Session, token: str) -> HostInvite:
    invite = (
        db.query(HostInvite).filter(HostInvite.token_hash == _hash(token)).first()
    )
    if not invite or invite.accepted_at is not None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That invitation is no longer valid."
        )
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status.HTTP_410_GONE, "That invitation has expired — ask for a new one."
        )
    if invite.org_id is not None:
        # A staff invitation outlives its organization only on paper.
        org = db.get(Host, invite.org_id)
        if not org or org.deleted_at is not None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, "That invitation is no longer valid."
            )
    return invite


@router.post("/accept")
def accept_invite(
    body: InviteAccept,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Create the login and sign them straight in.

    The password is set here, by them, and never travels or gets read aloud —
    which is the whole point of inviting rather than creating.
    """
    ip_key = f"{client_key(request)}:invite"
    enforce(db, {ip_key: IP_LIMIT})

    try:
        invite = _usable(db, body.token)
    except HTTPException:
        record(db, ip_key)
        raise

    if invite.org_id is not None:
        host = Host(
            name=invite.name or invite.email,
            email=invite.email,
            password_hash=hash_password(body.password),
            is_admin=False,
            org_id=invite.org_id,
        )
    else:
        host = Host(
            name=invite.organization,
            email=invite.email,
            password_hash=hash_password(body.password),
            is_admin=invite.is_admin,
        )
    db.add(host)
    invite.accepted_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "That email already has an account."
        )
    db.refresh(host)
    set_auth_cookie(
        response,
        create_access_token(
            host.id,
            "host",
            is_admin=host.is_superadmin,
            cred_hash=credential_fingerprint(host.password_hash),
        ),
    )
    return {"id": str(host.id), "email": host.email, "name": host.name}
