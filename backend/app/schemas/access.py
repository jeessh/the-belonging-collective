import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AccessGroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    # Superadmins may set up a group for another organization; anyone else
    # gets their own regardless.
    host_id: uuid.UUID | None = None


class AccessGroupRename(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class AccessGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    host_id: uuid.UUID
    host_name: str = ""
    name: str
    created_at: datetime
    pending_count: int = 0
    approved_count: int = 0


class AccessRequestIn(BaseModel):
    # The program whose page the member asked from, if any.
    event_id: uuid.UUID | None = None


class MembershipOut(BaseModel):
    """The member's own view of a request."""

    model_config = ConfigDict(from_attributes=True)

    group_id: uuid.UUID
    status: str
    requested_at: datetime
    decided_at: datetime | None = None


class RequestedViaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str


class AccessMemberOut(BaseModel):
    """One row of the console's members list for a group."""

    user_id: uuid.UUID
    first_name: str
    last_name: str
    email: str | None = None
    status: str
    requested_at: datetime
    decided_at: datetime | None = None
    requested_via: RequestedViaOut | None = None
