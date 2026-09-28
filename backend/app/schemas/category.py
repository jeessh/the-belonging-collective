from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

Label = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)
]


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    label: str
    sort_order: int
    created_at: datetime
    # Live programs filed under it. Filled by the list route; what the console
    # shows before an archive asks where those programs should go.
    event_count: int = 0


class CategoryCreate(BaseModel):
    label: Label


class CategoryUpdate(BaseModel):
    label: Label | None = None
    sort_order: int | None = None


class CategoryArchived(BaseModel):
    slug: str
    reassigned_to: str | None
    affected_events: int
    affected_members: int
