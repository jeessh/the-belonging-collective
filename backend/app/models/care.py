"""Care links: a caregiver supports a member.

Support, not proxy. The member keeps their own account and credential; the
link lets the caregiver see the member's saved list and save programs into
it. Linking needs the member's credential (or the caregiver creates the
account), so the link is the member's consent, not the caregiver's claim.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CareLink(Base):
    __tablename__ = "care_links"
    __table_args__ = (Index("ix_care_links_member", "member_id"),)

    caregiver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), primary_key=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Unlinked, not deleted — either side may set this; re-linking clears it.
    removed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    caregiver = relationship(
        "User", foreign_keys=[caregiver_id], back_populates="care_links"
    )
    member = relationship(
        "User", foreign_keys=[member_id], back_populates="caregiver_links"
    )

    @property
    def active(self) -> bool:
        return self.removed_at is None
