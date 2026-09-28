import uuid
from datetime import datetime

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

# Stripped before the length check, so "   " is refused rather than stored as "".
GroupName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
]


class AccessGroupIn(BaseModel):
    name: GroupName
    # Superadmins may set up a group for another organization; anyone else
    # gets their own regardless.
    host_id: uuid.UUID | None = None


class AccessGroupRename(BaseModel):
    name: GroupName


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
