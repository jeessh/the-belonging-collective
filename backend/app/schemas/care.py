from pydantic import BaseModel, EmailStr, Field

from app.core.security import PASSWORD_MIN_LENGTH


class MemberCredential(BaseModel):
    """A member's own credential, as the sign-in door takes it. Proving it is
    the consent to link — the same thing the member would type to sign in."""

    email: str
    password: str


class CareMemberCreate(BaseModel):
    """A caregiver setting up the person they support. The account is the
    member's: an email and password of their own."""

    first_name: str
    last_name: str
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH)
