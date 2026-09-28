from pydantic import BaseModel, EmailStr, Field, model_validator

from app.core.security import PASSWORD_MIN_LENGTH


class MemberCredential(BaseModel):
    """A member's own credential, as the sign-in doors take it: their name
    and icon key, or their email and password. Proving it is the consent to
    link — the same thing the member would type to sign in themselves."""

    first_name: str | None = None
    last_name: str | None = None
    icons: list[str] | None = None
    email: str | None = None
    password: str | None = None

    @property
    def method(self) -> str:
        return "password" if self.email is not None else "icons"

    @model_validator(mode="after")
    def _one_door(self):
        if self.email is not None:
            if not self.password:
                raise ValueError("Enter the password too.")
        elif not (self.first_name and self.last_name and self.icons):
            raise ValueError("Enter their name and icons.")
        return self


class CareMemberCreate(BaseModel):
    """A caregiver setting up the person they support. The account is the
    member's: an icon key they will tap, or an email and password of their
    own. The icons are returned so they can be handed over."""

    first_name: str
    last_name: str
    # Chosen by the pair, or omitted to have the server pick a free set.
    icons: list[str] | None = None
    email: EmailStr | None = None
    password: str | None = Field(None, min_length=PASSWORD_MIN_LENGTH)

    @property
    def method(self) -> str:
        return "password" if self.email is not None else "icons"

    @model_validator(mode="after")
    def _one_door(self):
        if self.email is not None and not self.password:
            raise ValueError("Set a password for the account.")
        return self
