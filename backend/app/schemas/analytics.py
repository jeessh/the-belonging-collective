import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class AnalyticsTotals(BaseModel):
    # Attendance rows created in the range. A save that was later undone still
    # counts: it happened, and un-saving only flips the row's status.
    saves: int
    unique_savers: int
    clicks: int
    # Distinct programs (a repeating program is one), by when they were posted.
    postings: int


class AnalyticsWeek(BaseModel):
    # Monday of the week, in America/Toronto.
    week: date
    saves: int
    clicks: int
    postings: int


class AnalyticsProgram(BaseModel):
    # The series id for a repeating program, else the event id.
    program_id: uuid.UUID
    # The occurrence to link to: the earliest-dated one.
    event_id: uuid.UUID
    title: str
    starts_at: datetime | None
    host_id: uuid.UUID
    host_name: str
    saves: int
    # Members who have it saved right now — not range-bound.
    going: int
    clicks: int
    archived: bool


class AnalyticsOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # `from` is a keyword, so the field is from_ and serializes under the alias.
    from_: date = Field(alias="from")
    to: date
    # Null = every organization (superadmins only).
    host_id: uuid.UUID | None
    host_name: str | None
    totals: AnalyticsTotals
    weekly: list[AnalyticsWeek]
    programs: list[AnalyticsProgram]
