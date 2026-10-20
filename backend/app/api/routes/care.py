"""Caregivers: the people who support a member.

Support, not proxy. A caregiver has their own account (a password account
with `is_caregiver`), the member keeps theirs, and a care link between the
two lets the caregiver see the member's saved list and save into it. Every
save made here is the member's row, under the member's rules — special access
is the member's approval, the hold is the member's spot.

Linking takes the member's own email and password, or the caregiver creates
the member's account on the spot. Both are rate-limited like sign-in: a link
attempt with a wrong credential is exactly what a brute-force sweep looks
like, and it counts against the same keys the sign-in door uses.

The member can also start it: they invite a caregiver by email
(`/users/me/caregivers/invites`), and whoever signs in with that email and
accepts (`/care-invites/{token}`) becomes linked. Either side ends a link the
same way, whichever door made it.
"""

import hashlib
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
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.attendance import save_event, saved_events, unsave_event
from app.api.routes.auth import (
    _live_member_by_email,
    credential_identity,
    member_by_credential,
    new_member,
)
from app.core import gcal, holds, ical
from app.core.config import settings
from app.core.mail import send as send_mail
from app.core.rate_limit import (
    IDENTITY_LIMIT,
    IP_LIMIT,
    clear,
    client_key,
    enforce,
    record,
)
from app.models.care import CareInvite, CareLink
from app.models.user import User
from app.schemas.care import (
    CaregiverInviteCreate,
    CareMemberCreate,
    MemberCredential,
)
from app.schemas.event import EventOut
from app.schemas.user import CarePerson

router = APIRouter(prefix="/users/me", tags=["care"])
# The invitee's side of a member's invitation: preview it, accept it.
invite_router = APIRouter(prefix="/care-invites", tags=["care"])

NOT_LINKED = "You are not linked to that member."
INVITE_DAYS = 14
INVITE_GONE = "That invitation is no longer valid."


def _require_caregiver(user: User) -> None:
    if not user.is_caregiver:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only caregiver accounts can do this.",
        )


def _member_for(db: Session, caregiver: User, member_id: uuid.UUID) -> User:
    """The live member behind an active link, or a 403. Every care route
    goes through this, so an unlinked pair fails the same way everywhere."""
    link = db.get(CareLink, {"caregiver_id": caregiver.id, "member_id": member_id})
    if link is None or not link.active or link.member.deleted_at is not None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, NOT_LINKED)
    return link.member


def _link(db: Session, caregiver: User, member: User) -> None:
    """Create the link, or revive one that was removed."""
    link = db.get(CareLink, {"caregiver_id": caregiver.id, "member_id": member.id})
    if link is None:
        db.add(CareLink(caregiver_id=caregiver.id, member_id=member.id))
    else:
        link.removed_at = None
    db.commit()


@router.get("/care", response_model=list[CarePerson])
def list_care(user: User = Depends(get_current_user)):
    return user.care


@router.post("/care/members", status_code=status.HTTP_201_CREATED)
def create_care_member(
    body: CareMemberCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Make the member's account and link it. The account is theirs, with an
    email and password of their own."""
    _require_caregiver(user)
    ip_key = client_key(request)
    id_key = f"care-create:{user.id}"
    enforce(db, {id_key: IDENTITY_LIMIT, ip_key: IP_LIMIT})
    # Every attempt counts, not only failures: what is being metered is
    # account creation, and a run of successes is the thing worth capping.
    record(db, id_key, ip_key)

    email = body.email.strip().lower()
    if _live_member_by_email(db, email):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "That email already has an account."
        )
    member = new_member(
        db, body.first_name, body.last_name, email=email, password=body.password
    )
    _link(db, user, member)
    return {
        "id": str(member.id),
        "first_name": member.first_name,
        "last_name": member.last_name,
        "email": member.email,
    }


@router.post("/care/links", response_model=CarePerson, status_code=status.HTTP_201_CREATED)
def link_member(
    body: MemberCredential,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Link an existing member by proving their credential — the consent is
    the member typing what they would use to sign in."""
    _require_caregiver(user)
    ip_key = client_key(request)
    id_key = credential_identity(body.email)
    enforce(db, {id_key: IDENTITY_LIMIT, ip_key: IP_LIMIT})
    member = member_by_credential(db, body.email, body.password)
    if member is None:
        record(db, id_key, ip_key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password.")
    if member.id == user.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "That's your own account. Use the email and password of the person "
            "you support.",
        )
    clear(db, id_key)
    _link(db, user, member)
    return member


@router.delete("/care/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_member(
    member_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The caregiver steps back. The row stays with `removed_at` set."""
    link = db.get(CareLink, {"caregiver_id": user.id, "member_id": member_id})
    if link is None or not link.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_LINKED)
    link.removed_at = func.now()
    db.commit()


@router.delete("/caregivers/{caregiver_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_caregiver(
    caregiver_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The member's side of the same thing: they choose who supports them."""
    link = db.get(CareLink, {"caregiver_id": caregiver_id, "member_id": user.id})
    if link is None or not link.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That person is not linked.")
    link.removed_at = func.now()
    db.commit()


@router.get("/care/{member_id}/events", response_model=list[EventOut])
def care_events(
    member_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The member's saved list, exactly as they see it."""
    member = _member_for(db, user, member_id)
    rows = saved_events(db, member)
    out = [EventOut.model_validate(row) for row in rows]
    holds.annotate(rows, out, member.id)
    return out


@router.get("/care/{member_id}/events/calendar.ics")
def care_events_calendar(
    member_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = _member_for(db, user, member_id)
    return Response(
        ical.build(saved_events(db, member)),
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{member.first_name}-programs.ics"'
        },
    )


@router.post(
    "/care/{member_id}/events/{event_id}/attend",
    status_code=status.HTTP_201_CREATED,
)
def care_attend(
    member_id: uuid.UUID,
    event_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save for the member. Their row, their hold, their special access — and
    their Google Calendar, if they connected one."""
    member = _member_for(db, user, member_id)
    result = save_event(db, member, event_id)
    gcal.after_save(background, member)
    return result


@router.delete(
    "/care/{member_id}/events/{event_id}/attend",
    status_code=status.HTTP_204_NO_CONTENT,
)
def care_unattend(
    member_id: uuid.UUID,
    event_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = _member_for(db, user, member_id)
    unsave_event(db, member, event_id)
    gcal.after_save(background, member)


# --- The member invites a caregiver ------------------------------------------


def _invite_hash(token: str) -> str:
    # 32 random bytes: a plain SHA-256 is right, as for host invitations.
    return hashlib.sha256(token.encode()).hexdigest()


def _short_name(user: User) -> str:
    """"Sam R." — what the invitee sees of the member before accepting."""
    return f"{user.first_name} {user.last_name[:1]}.".strip()


def _invite_out(invite: CareInvite) -> dict:
    return {
        "id": str(invite.id),
        "email": invite.email,
        "created_at": invite.created_at,
        "expires_at": invite.expires_at,
    }


def _pending(db: Session, member: User) -> list[CareInvite]:
    now = datetime.now(timezone.utc)
    return (
        db.query(CareInvite)
        .filter(
            CareInvite.member_id == member.id,
            CareInvite.accepted_at.is_(None),
            CareInvite.revoked_at.is_(None),
            CareInvite.expires_at > now,
        )
        .order_by(CareInvite.created_at.desc())
        .all()
    )


@router.get("/caregivers/invites")
def list_caregiver_invites(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """The member's invitations still waiting for an answer."""
    return [_invite_out(i) for i in _pending(db, user)]


@router.post("/caregivers/invites", status_code=status.HTTP_201_CREATED)
def invite_caregiver(
    body: CaregiverInviteCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mail an invitation to be this member's caregiver.

    Returns the link once as well (only its hash is stored), so the member
    can pass it on by hand — read it out, text it — if the mail doesn't
    arrive. Inviting the same address again replaces the waiting one, so
    there is only ever one live link per person.

    Community members only: a caregiver account supports others, it doesn't
    invite people to support it."""
    if user.is_caregiver:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Caregiver accounts can't invite a caregiver.",
        )
    ip_key = client_key(request)
    id_key = f"care-invite:{user.id}"
    enforce(db, {id_key: IDENTITY_LIMIT, ip_key: IP_LIMIT})
    record(db, id_key, ip_key)

    email = body.email.strip().lower()
    if user.email and email == user.email.lower():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "That's your own email. Enter the email of the person who supports you.",
        )
    if any(
        link.active and (link.caregiver.email or "").lower() == email
        for link in user.caregiver_links
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "That person already supports you."
        )
    now = datetime.now(timezone.utc)
    for old in _pending(db, user):
        if old.email == email:
            old.revoked_at = now

    token = secrets.token_urlsafe(32)
    invite = CareInvite(
        token_hash=_invite_hash(token),
        member_id=user.id,
        email=email,
        expires_at=now + timedelta(days=INVITE_DAYS),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    link = f"{settings.FRONTEND_ORIGIN}/care/invite/{token}"
    name = f"{user.first_name} {user.last_name}".strip()
    send_mail(
        email,
        f"{name} invited you to be their caregiver",
        f"""Hello,

{name} invited you to be their caregiver on The Belonging Collective.

As their caregiver you can see the programs they have saved and save programs for them. They keep their own account, and either of you can end the link at any time.

Open this link to accept. Sign in, or create an account, with this email address ({email}). The link stops working after {INVITE_DAYS} days:

{link}

If you weren't expecting this, you can ignore it.
""",
        button=("See the invitation", link),
    )
    return {**_invite_out(invite), "link": link}


@router.delete("/caregivers/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_caregiver_invite(
    invite_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The member takes an invitation back before it is answered."""
    invite = db.get(CareInvite, invite_id)
    if invite is None or invite.member_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, INVITE_GONE)
    if invite.accepted_at is None and invite.revoked_at is None:
        invite.revoked_at = func.now()
        db.commit()


def _usable_invite(db: Session, token: str) -> CareInvite:
    invite = (
        db.query(CareInvite)
        .filter(CareInvite.token_hash == _invite_hash(token))
        .first()
    )
    if (
        invite is None
        or invite.accepted_at is not None
        or invite.revoked_at is not None
        or invite.member.deleted_at is not None
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, INVITE_GONE)
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status.HTTP_410_GONE, "That invitation has expired. Ask for a new one."
        )
    return invite


@invite_router.get("/{token}")
def preview_care_invite(token: str, db: Session = Depends(get_db)):
    """What the accept page shows before anyone signs in: who is asking, and
    which email has to accept. The member's surname is an initial only."""
    invite = _usable_invite(db, token)
    return {
        "member": _short_name(invite.member),
        "member_first_name": invite.member.first_name,
        "email": invite.email,
    }


@invite_router.post("/{token}/accept", response_model=CarePerson)
def accept_care_invite(
    token: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Become the member's caregiver. Only the account signed in with the
    invited email may accept, so a forwarded link can't link a stranger.
    Accepting turns the account into a caregiver account if it wasn't."""
    invite = _usable_invite(db, token)
    if (user.email or "").lower() != invite.email:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"This invitation is for {invite.email}. Sign in with that email to accept it.",
        )
    if user.id == invite.member_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "You can't be your own caregiver."
        )
    user.is_caregiver = True
    invite.accepted_at = func.now()
    invite.accepted_by = user.id
    _link(db, user, invite.member)
    return invite.member
