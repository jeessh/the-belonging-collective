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
"""

import uuid

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
from app.core.rate_limit import (
    IDENTITY_LIMIT,
    IP_LIMIT,
    clear,
    client_key,
    enforce,
    record,
)
from app.models.care import CareLink
from app.models.user import User
from app.schemas.care import CareMemberCreate, MemberCredential
from app.schemas.event import EventOut
from app.schemas.user import CarePerson

router = APIRouter(prefix="/users/me", tags=["care"])

NOT_LINKED = "You are not linked to that member."


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
