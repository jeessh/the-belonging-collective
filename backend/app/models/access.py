"""Special access: per-organization groups a member is approved into.

Some programs are only for people an agency has already agreed to serve — a
residential program's residents, a closed support group. Access is granted to
the *group*, not the event, so one approval covers that group's future
programs too. The agency knows who belongs; the platform only carries the
request and the answer.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

# Membership statuses. A row is never deleted; it moves between these.
REQUESTED = "requested"
APPROVED = "approved"
DECLINED = "declined"
REVOKED = "revoked"
STATUSES = {REQUESTED, APPROVED, DECLINED, REVOKED}


class AccessGroup(Base):
    __tablename__ = "access_groups"
    __table_args__ = (
        # Unique per organization over live rows only, case-insensitively —
        # the same rule as uq_hosts_email_live, so an archived group releases
        # its name.
        Index(
            "uq_access_groups_host_name_live",
            "host_id",
            text("lower(name)"),
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    host_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hosts.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Archived, not destroyed. Refused while live events still point here.
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    host = relationship("Host")
    memberships = relationship("AccessMembership", back_populates="group")


class AccessMembership(Base):
    """One member's standing with one group. The primary key is the pair, so
    a member has exactly one status per group and re-requesting reuses the
    row rather than piling up history."""

    __tablename__ = "access_memberships"
    __table_args__ = (Index("ix_access_memberships_group", "group_id", "status"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), primary_key=True
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("access_groups.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, default=REQUESTED)
    # The program whose page they asked from, so the admin can see what
    # prompted the request. Optional: a request can come from anywhere.
    requested_via_event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="RESTRICT"), nullable=True
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    decided_by_host_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hosts.id", ondelete="RESTRICT"), nullable=True
    )

    user = relationship("User")
    group = relationship("AccessGroup", back_populates="memberships")
    requested_via = relationship("Event", foreign_keys=[requested_via_event_id])
