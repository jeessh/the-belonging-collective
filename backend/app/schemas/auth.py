from pydantic import BaseModel, EmailStr, Field

from app.core.security import PASSWORD_MIN_LENGTH


class UserSignup(BaseModel):
    """The password door: a member who would rather have an email and a
    password than an icon key. Login is then email + password."""

    first_name: str
    last_name: str
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH)
    # Onboarding prefs (free-form slugs from the FE chip taxonomy). Default to
    # empty, never null.
    accessibility_prefs: list[str] = []
    interest_categories: list[str] = []


class UserAuth(BaseModel):
    """Unified member entry: log in if the name + icon key matches an existing
    account, otherwise create it. The icon set is the credential."""

    first_name: str
    last_name: str
    icons: list[str]
    # Set only after the member has been told the name is already in use and has
    # confirmed they are someone else. Without it, a name that already exists
    # plus non-matching icons is treated as a mistap, not a new person — see
    # auth_user. Names are deliberately not unique, so this escape hatch has to
    # exist; it just must not be the default.
    create_new: bool = False
    # Applied only when a new account is created (ignored on login).
    accessibility_prefs: list[str] = []
    interest_categories: list[str] = []


class UserLogin(BaseModel):
    # Plain str, as for HostLogin: a lookup key, not something to validate.
    email: str
    password: str


class HostLogin(BaseModel):
    # Plain str on login: it's a lookup key, and validating here could lock out
    # accounts created before EmailStr was enforced on signup.
    email: str
    password: str


class HostForgot(BaseModel):
    # Plain str, matching HostLogin and for the same reason: accounts predating
    # EmailStr on signup would be rejected here before the lookup ever ran. An
    # organizer who can't sign in because of a legacy address is precisely who
    # this endpoint exists for, so refusing to look them up defeats it.
    email: str


class HostReset(BaseModel):
    token: str
    password: str = Field(min_length=PASSWORD_MIN_LENGTH)
