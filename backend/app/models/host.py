import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Host(Base):
    """An organizer login. Two kinds share the table:

    • an organization (`org_id` null) — the agency's own shared login, and the
      row that owns its programs, groups and invitations;
    • a staff login (`org_id` set) — one person at that organization, with
      their own name, email and password. Everything they do is done as the
      organization: ownership checks go through `org_id_of`, and their access
      level is the organization's `is_admin`.

    Superadmins are organizations with is_admin=True (and their staff).
    """

    __tablename__ = "hosts"
    __table_args__ = (
        Index(
            "uq_hosts_email_live",
            "email",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("ix_hosts_org", "org_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # The organization's name, or — on a staff login — the person's.
    name: Mapped[str] = mapped_column(Text)
    # Unique among LIVE accounts only — see __table_args__. A column-level
    # UNIQUE (the old hosts_email_key) would have let an archived account go on
    # holding its address forever, so an agency that left and came back could
    # never be invited under the same email again.
    email: Mapped[str] = mapped_column(Text)
    password_hash: Mapped[str] = mapped_column(Text)
    # Meaningful on organization rows only; always false on a staff login,
    # whose tier is read through `is_superadmin`.
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    # Shown in the member feed's organization stepper. Null falls back to the
    # organization's initials.
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Set on a staff login: the organization it belongs to.
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hosts.id", ondelete="RESTRICT"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Archived, not destroyed — same rule as Event and User. The account has to
    # outlive its removal because its programs carry host_id as their
    # attribution, and "which agency ran this" is what goes in a grant
    # application. Removing the row instead would cascade those programs away.
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    events = relationship(
        "Event",
        back_populates="host",
        cascade="all, delete-orphan",
        foreign_keys="Event.host_id",
    )
    org = relationship("Host", remote_side=[id], foreign_keys=[org_id])

    @property
    def is_staff(self) -> bool:
        return self.org_id is not None

    @property
    def is_superadmin(self) -> bool:
        """The access level in force: the organization's, for a staff login.

        Read through the row, never the token — `require_admin` and every
        ownership check use this, so changing an organization's tier applies
        to its staff on their next request.
        """
        return self.org.is_admin if self.org_id is not None else self.is_admin


def org_id_of(host: Host) -> uuid.UUID:
    """The organization a login acts for. Every ownership check goes through
    this, so a staff login and the shared login see the same programs."""
    return host.org_id or host.id
