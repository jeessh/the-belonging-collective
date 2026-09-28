"""Topics — the taxonomy programs are filed under and members pick as interests.

The slug is the identity and never changes; the label is display-only. Both
`events.categories` (and its first-entry mirror `events.category`) and
`users.interest_categories` store slugs, and matching is slug equality, so a
superadmin can rename a topic without a single match breaking. Archived, never
deleted — an archived slug stays taken so nothing old is ever re-read as
something new.
"""

from datetime import datetime

from sqlalchemy import DateTime, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Category(Base):
    __tablename__ = "categories"

    slug: Mapped[str] = mapped_column(Text, primary_key=True)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
