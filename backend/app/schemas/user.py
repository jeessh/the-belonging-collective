import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# Dismissed recommendations are the only member-writable list without a fixed
# vocabulary, so it gets a hard cap: enough for years of waving programs away,
# small enough that nobody can use the column as storage.
DISMISSED_MAX = 500
DISMISSED_ID_MAX_LEN = 64


class CarePerson(BaseModel):
    """One side of a care link, as the other side sees it."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    # The initial only, when this is a caregiver seen by their member.
    last_name: str
    avatar_url: str | None = None
    avatar_emblem: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    username: str
    is_caregiver: bool = False
    # Members this account supports (models/care.py), and who supports it.
    care: list[CarePerson] = []
    caregivers: list[CarePerson] = []
    # The login. Null only on a legacy icon account, which can't sign in.
    email: str | None = None
    # A photo or an emblem slug, never both.
    avatar_url: str | None = None
    avatar_emblem: str | None = None
    # 'password', or 'icon' for a legacy account that needs one set.
    auth_type: str
    accessibility_prefs: list[str]
    interest_categories: list[str]
    tts_enabled: bool
    voice_commands_enabled: bool
    eye_tracking_enabled: bool
    preferred_view: str = "card"
    dismissed_program_ids: list[str] = []
    # Null until the first-run tour has been seen.
    onboarded_at: datetime | None = None
    # connected | available | off — models/user.User.google_calendar.
    google_calendar: str = "off"
    created_at: datetime


class UserCreate(BaseModel):
    """A superadmin setting up a member account for someone. The server
    generates a temporary password and returns it once, to be read out."""

    first_name: str
    last_name: str
    email: EmailStr


class UserSetPassword(BaseModel):
    """A superadmin resetting a member's password: the email the account will
    sign in with (entered or confirmed), a temporary password generated."""

    email: EmailStr


class UserUpdate(BaseModel):
    """Admin-editable fields on a user account."""

    first_name: str | None = None
    last_name: str | None = None


class UserPrefsUpdate(BaseModel):
    """Self-service preference update for PATCH /users/me. All fields optional;
    only those sent (exclude_unset) are applied to the authenticated member."""

    accessibility_prefs: list[str] | None = None
    interest_categories: list[str] | None = None
    tts_enabled: bool | None = None
    voice_commands_enabled: bool | None = None
    eye_tracking_enabled: bool | None = None
    preferred_view: Literal["card", "list"] | None = None
    # Full replacement, not a diff — the client owns the list.
    dismissed_program_ids: (
        list[Annotated[str, Field(min_length=1, max_length=DISMISSED_ID_MAX_LEN)]]
        | None
    ) = Field(None, max_length=DISMISSED_MAX)
    # `true` stamps onboarded_at with now; `false` is ignored rather than
    # clearing it, so the tour can't be un-seen by a stray write.
    onboarded: bool | None = None
    # The login, so it may change but not be cleared. Stored lowercase.
    email: EmailStr | None = None
    # Only null is accepted here: a photo is set through POST /users/me/avatar,
    # so nobody can point their picture at an arbitrary address.
    avatar_url: None = None
    # One of core/avatars.EMBLEMS, or null to clear. Setting it drops the photo.
    avatar_emblem: str | None = None
    # Turning it off keeps existing links; it only hides the caregiver tools.
    is_caregiver: bool | None = None
