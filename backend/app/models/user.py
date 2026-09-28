import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Index,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class User(Base):
    """A community member. Signs in one of two ways, chosen at signup:

    * icon — the key is the full name PLUS the ordered icon set, so uniqueness
      is on (username, icons): people can share a name, and even the same
      icons, as long as the two together differ.
    * password — identified by email, with a password of their own choosing.
      Icons are still allocated (the column and constraint need them) but are
      never shown.
    """

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("username", "icons", name="uq_users_username_icons"),
        # Live accounts only, as for uq_hosts_email_live: an archived member
        # releases the address.
        Index(
            "uq_users_email_live",
            text("lower(email)"),
            unique=True,
            postgresql_where=text("email IS NOT NULL AND deleted_at IS NULL"),
        ),
        Index("uq_users_share_token", "share_token", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    first_name: Mapped[str] = mapped_column(Text)
    last_name: Mapped[str] = mapped_column(Text)
    username: Mapped[str] = mapped_column(Text, index=True)  # firstname_lastname
    # The sign-in name for a password account; optional for an icon account,
    # where it is only a channel for reminders and change notices. Lowercase.
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Profile picture: an uploaded photo or one of core/avatars.EMBLEMS, never
    # both. Emblems are deliberately not sign-in icons — those are the password.
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_emblem: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Public handle for the member's saved list (GET /shared/{token}).
    share_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_hash: Mapped[str] = mapped_column(Text)
    # 'icon' (default) means password is the icon slugs; 'password' means custom.
    auth_type: Mapped[str] = mapped_column(Text, default="icon")
    # ARRAY(Text) not ARRAY(String): the DB columns are text[], and equality
    # filters (see _allocate_unique_icons) bind the literal with the column's
    # type — String binds varchar[], which has no `text[] = varchar[]` operator.
    icons: Mapped[list[str]] = mapped_column(ARRAY(Text))  # unique identifier
    # Personalization prefs set during onboarding. Free-form slugs (the FE chip
    # taxonomy constrains input); used to SORT the feed, never to filter it.
    accessibility_prefs: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default="{}"
    )
    interest_categories: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default="{}"
    )
    # Voice-accessibility prefs — persisted to profile, toggled in settings.
    tts_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    voice_commands_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    eye_tracking_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # card | list — how the member last chose to see the feed. Values are
    # enforced by the schema (UserPrefsUpdate), as for auth_type.
    preferred_view: Mapped[str] = mapped_column(
        Text, nullable=False, default="card", server_default=text("'card'")
    )
    # Recommendations the member waved away. A program id is the event's
    # series_id when it has one, else its id, so dismissing one date of a
    # repeating program dismisses the run. Replaced whole on each write.
    dismissed_program_ids: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default="{}"
    )
    # When the first-run tour was seen; null until then.
    onboarded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Somebody who supports a member (models/care.py). Opens the caregiver
    # tools; says nothing about how this account signs in.
    is_caregiver: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Archived, not destroyed — see Event.deleted_at. An archived member can't
    # sign in, and still holds their (username, icons) slot, so nobody
    # accidentally inherits their key.
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # No delete-orphan — see Event.attendees. Archiving a member must not erase
    # them from the counts their programs already reported.
    attending = relationship("Attendance", back_populates="user")

    # Both directions of care_links. No cascade: a link outlives an archived
    # account the same way attendance does.
    care_links = relationship(
        "CareLink", foreign_keys="CareLink.caregiver_id", back_populates="caregiver"
    )
    caregiver_links = relationship(
        "CareLink", foreign_keys="CareLink.member_id", back_populates="member"
    )

    @property
    def care(self) -> list["User"]:
        """The live members this account currently supports."""
        return [
            link.member
            for link in self.care_links
            if link.active and link.member.deleted_at is None
        ]

    @property
    def caregivers(self) -> list[dict]:
        """Who currently supports this member — first name and last initial.
        The member sees who can save for them; the caregiver's full name and
        email are theirs."""
        return [
            {
                "id": link.caregiver.id,
                "first_name": link.caregiver.first_name,
                "last_name": link.caregiver.last_name[:1],
                "avatar_url": link.caregiver.avatar_url,
                "avatar_emblem": link.caregiver.avatar_emblem,
            }
            for link in self.caregiver_links
            if link.active and link.caregiver.deleted_at is None
        ]
