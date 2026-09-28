import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

# Dismissed recommendations are the only member-writable list without a fixed
# vocabulary, so it gets a hard cap: enough for years of waving programs away,
# small enough that nobody can use the column as storage.
DISMISSED_MAX = 500
DISMISSED_ID_MAX_LEN = 64


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    username: str
    # The login for a password account; optional for an icon account.
    email: str | None = None
    # A photo or an emblem slug, never both.
    avatar_url: str | None = None
    avatar_emblem: str | None = None
    # 'icon' or 'password' — which door the member uses.
    auth_type: str
    icons: list[str]
    accessibility_prefs: list[str]
    interest_categories: list[str]
    tts_enabled: bool
    voice_commands_enabled: bool
    eye_tracking_enabled: bool
    preferred_view: str = "card"
    dismissed_program_ids: list[str] = []
    # Null until the first-run tour has been seen.
    onboarded_at: datetime | None = None
    created_at: datetime

    @model_validator(mode="after")
    def _hide_unused_icons(self):
        # A password account still holds an allocated icon set (the column and
        # its unique constraint need one), but it is not a credential anyone
        # should ever see — not the member, not the console.
        if self.auth_type != "icon":
            self.icons = []
        return self


class UserCreate(BaseModel):
    """A superadmin setting up a member account for someone.

    Staff already do this — the scoping notes describe support workers
    registering on a member's behalf. The icons come back in the response so
    they can be written down and handed over; there is no other way to recover
    them.
    """

    first_name: str
    last_name: str
    # Omit to have the server pick an unused set.
    icons: list[str] | None = None


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
    # An icon account may set, change or clear (null) it; a password account
    # may change it — it is their login — but not clear it. Stored lowercase.
    email: EmailStr | None = None
    # Only null is accepted here: a photo is set through POST /users/me/avatar,
    # so nobody can point their picture at an arbitrary address.
    avatar_url: None = None
    # One of core/avatars.EMBLEMS, or null to clear. Setting it drops the photo.
    avatar_emblem: str | None = None
