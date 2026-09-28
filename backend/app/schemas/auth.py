from pydantic import BaseModel, EmailStr, Field

from app.core.security import PASSWORD_MIN_LENGTH


class UserSignup(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH)
    # Onboarding prefs (free-form slugs from the FE chip taxonomy). Default to
    # empty, never null.
    accessibility_prefs: list[str] = []
    interest_categories: list[str] = []
    # A caregiver's account is a member account with the flag on — see models/care.py.
    is_caregiver: bool = False


class UserLogin(BaseModel):
    # Plain str, as for HostLogin: a lookup key, not something to validate.
    email: str
    password: str


class UserForgot(BaseModel):
    email: str


class UserReset(BaseModel):
    token: str
    password: str = Field(min_length=PASSWORD_MIN_LENGTH)


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
