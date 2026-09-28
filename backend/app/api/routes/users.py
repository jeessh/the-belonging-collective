import secrets
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_db, require_admin
from app.core.avatars import EMBLEMS
from app.core.categories import require_live_slugs
from app.models.care import CareLink
from app.models.host import Host
from app.models.user import User
from app.core.security import hash_password
from app.schemas.user import (
    UserCreate,
    UserOut,
    UserPrefsUpdate,
    UserSetPassword,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(
    body: UserPrefsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """A member updates their own preferences (voice/accessibility/interests),
    email and profile picture. Defined before /{user_id} so the literal path
    wins the match."""
    fields = body.model_dump(exclude_unset=True)
    # A flag in, a timestamp out. Only ever set forward — see UserPrefsUpdate.
    if fields.pop("onboarded", None) and user.onboarded_at is None:
        user.onboarded_at = func.now()
    if "email" in fields:
        email = fields.pop("email")
        # The email is the login, so it can move but not go.
        if email is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "This account signs in with its email, so it needs one.",
            )
        user.email = email.strip().lower()
    if "avatar_emblem" in fields:
        emblem = fields.pop("avatar_emblem")
        if emblem is not None:
            if emblem not in EMBLEMS:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown emblem")
            user.avatar_url = None
        user.avatar_emblem = emblem
    if "avatar_url" in fields:
        fields.pop("avatar_url")
        user.avatar_url = None
    if fields.get("interest_categories"):
        require_live_slugs(db, fields["interest_categories"])
    for field, value in fields.items():
        setattr(user, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Another member already uses that email."
        )
    db.refresh(user)
    return user


# A picture is small; the 2 MB cap is a fraction of the cover-image one.
ALLOWED_AVATAR_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_AVATAR_BYTES = 2 * 1024 * 1024


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """A profile photo, stored the same way event images are. Replaces any
    emblem — a member has one picture, not two."""
    from app.api.routes.events import _store_upload

    url = await _store_upload(
        file,
        ALLOWED_AVATAR_TYPES,
        MAX_AVATAR_BYTES,
        "Photo is too large (max 2 MB).",
        "Please choose a PNG, JPEG, or WebP photo.",
    )
    user.avatar_url = url
    user.avatar_emblem = None
    db.commit()
    db.refresh(user)
    return user


# ---------- Admin-only account management ----------


@router.get("", response_model=list[UserOut])
def list_users(
    _: Host = Depends(require_admin), db: Session = Depends(get_db)
):
    return (
        db.query(User)
        .filter(User.deleted_at.is_(None))
        # UserOut reads links in both directions; without these it is a query
        # per row.
        .options(
            selectinload(User.care_links).selectinload(CareLink.member),
            selectinload(User.caregiver_links).selectinload(CareLink.caregiver),
        )
        .order_by(User.created_at.desc())
        .all()
    )


def _temporary_password() -> str:
    """Something staff can read out over a desk: three short lowercase groups
    (about 47 bits) — the member is expected to change it."""
    return "-".join(secrets.token_hex(2) for _ in range(3))


def _live_user(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.post("", status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    _: Host = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a member account on someone's behalf, with a temporary password
    returned once so it can be read out.

    Deliberately does NOT set an auth cookie: the caller is a superadmin doing
    admin work, and signing them in as the new member would end their session.
    """
    from app.api.routes.auth import _live_member_by_email, new_member

    email = body.email.strip().lower()
    if _live_member_by_email(db, email):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "That email already has an account."
        )
    password = _temporary_password()
    user = new_member(
        db, body.first_name, body.last_name, email=email, password=password
    )
    return {
        "id": str(user.id),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "password": password,
    }


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    _: Host = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.api.routes.auth import _allocate_unique_icons, _make_username

    user = _live_user(db, user_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    # The username is internal now, but (username, icons) is still unique, so
    # a renamed account takes a fresh hidden set under its new name.
    username = _make_username(user.first_name, user.last_name)
    if username != user.username:
        user.username = username
        user.icons = _allocate_unique_icons(db, username)
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/set-password")
def set_user_password(
    user_id: uuid.UUID,
    body: UserSetPassword,
    _: Host = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """A superadmin gives a member a temporary password, returned once to be
    read out. This is how a legacy icon account gets back in: it becomes a
    password account under the email entered here.

    The old credential stops working the moment this returns — for sessions
    already open too, because member tokens carry a fingerprint of the
    credential they were issued against (see deps._key_still_current).
    """
    from app.api.routes.auth import _live_member_by_email

    user = _live_user(db, user_id)
    email = body.email.strip().lower()
    other = _live_member_by_email(db, email)
    if other and other.id != user.id:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Another member already uses that email."
        )
    password = _temporary_password()
    user.email = email
    user.password_hash = hash_password(password)
    user.auth_type = "password"
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Another member already uses that email."
        )
    return {"id": str(user.id), "email": email, "password": password}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: uuid.UUID,
    _: Host = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Archive the member. They can no longer sign in, but their attendance
    rows stay, so the programs they attended keep the numbers they already
    reported.

    There is deliberately no un-archive route yet; if one is needed, it belongs
    with the rest of member management rather than bolted onto DELETE.
    """
    user = _live_user(db, user_id)
    user.deleted_at = func.now()
    db.commit()
