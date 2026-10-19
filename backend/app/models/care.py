"""Care links: a caregiver supports a member.

Support, not proxy. The member keeps their own account and credential; the
link lets the caregiver see the member's saved list and save programs into
it. Linking needs the member's credential (or the caregiver creates the
account), or starts with the member inviting the caregiver (`CareInvite`),
so the link is the member's consent, not the caregiver's claim.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Text, func
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


class CareInvite(Base):
    """A member asking someone to be their caregiver (migration 0027).

    The other door into a care link. `CareLink` rows made by a caregiver
    prove the member's consent with the member's credential; this one starts
    with the member, so the consent is theirs from the beginning and their
    password never leaves their hands. The invitation names an email, and
    only the account signed in with that email can accept it.

    Only the hash of the token is kept, as for `HostInvite`. Withdrawn
    invitations get `revoked_at`, accepted ones `accepted_at`; neither is
    deleted.
    """

    __tablename__ = "care_invites"
    __table_args__ = (Index("ix_care_invites_member", "member_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    # Lowercased. The account that accepts must be signed in with it.
    email: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    accepted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    member = relationship("User", foreign_keys=[member_id])
