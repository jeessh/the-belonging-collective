import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import PASSWORD_MIN_LENGTH


def _clean_name(value: str | None) -> str | None:
    """Trim, and reject a name that was only whitespace.

    min_length alone accepts "   " — three characters — which then strips down
    to an empty display name in the database with no error surfaced anywhere.
    """
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("Name can't be blank")
    return trimmed


class HostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # The organization's name — or, on a staff login, the person's.
    name: str
    email: str
    is_admin: bool
    logo_url: str | None = None
    # Set on a staff login: the organization it belongs to.
    org_id: uuid.UUID | None = None
    created_at: datetime


class HostMeOut(HostOut):
    """The signed-in login and the organization it acts for.

    `org` is the login's own row for an organization's shared login, and the
    parent row for a staff login; `is_admin` here is the level in force
    (the organization's), not the column on the staff row.
    """

    is_staff: bool = False
    org: HostOut


class HostWithCountsOut(HostOut):
    """HostOut plus how many programs the account owns and who its staff are.

    The admins list needs the count to warn, before anyone confirms a removal,
    how many programs are about to be retired with the account.
    """

    event_count: int = 0
    staff: list[HostOut] = []


class TeamOut(BaseModel):
    """An organization's logins: the shared one, its staff, and who is invited."""

    org: HostOut
    staff: list[HostOut]
    invites: list["StaffInviteOut"]


class StaffInviteOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    expires_at: datetime
    expired: bool


class HostCreate(BaseModel):
    """A superadmin creating an account for an organizer.

    There is no self-serve host signup: accounts exist because a superadmin
    made one.
    """

    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH)
    # Whether the new account can manage other admins. Off unless asked for.
    is_admin: bool = False
    # Shown in the member feed's organization stepper.
    logo_url: str | None = None

    _strip_name = field_validator("name")(_clean_name)


class HostSelfUpdate(BaseModel):
    """What an organization may change about itself.

    Deliberately only the logo. HostUpdate carries `is_admin` and `password`,
    and an account editing itself through that schema could hand itself
    superadmin — the tier has to stay something only another superadmin grants.
    """

    logo_url: str | None = None


class HostUpdate(BaseModel):
    name: str | None = Field(None, min_length=1)
    is_admin: bool | None = None
    # Setting this resets the account's password; omitted leaves it alone.
    password: str | None = Field(None, min_length=PASSWORD_MIN_LENGTH)
    logo_url: str | None = None

    _strip_name = field_validator("name")(_clean_name)
