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

from app.core.config import settings
from app.db.session import Base


class User(Base):
    """A community member. Signs in with an email and a password.

    Icon keys were retired 2026-09-28. `icons` is still allocated per
    account because the column is NOT NULL and half of
    uq_users_username_icons; it is never shown and never a credential. Rows
    with auth_type 'icon' predate the change and can't sign in until a
    superadmin sets them a password (POST /users/{id}/set-password) or they
    reset one by email.
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
        Index("uq_users_calendar_token", "calendar_token", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    first_name: Mapped[str] = mapped_column(Text)
    last_name: Mapped[str] = mapped_column(Text)
    username: Mapped[str] = mapped_column(Text, index=True)  # firstname_lastname
    # The sign-in name. Nullable only for legacy icon accounts. Lowercase.
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Profile picture: an uploaded photo or one of core/avatars.EMBLEMS, never
    # both. Emblems are deliberately not sign-in icons — those are the password.
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_emblem: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Public handle for the member's saved list (GET /shared/{token}).
    share_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Private handle for the member's calendar feed (GET /calendar/{token}.ics):
    # the whole saved list, special access included, unlike the share link.
    calendar_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Last time a calendar app fetched that feed — i.e. it is subscribed.
    calendar_feed_fetched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Connected Google Calendar (core/gcal.py): the refresh token, encrypted,
    # and the calendar the app made in their account. The token is cleared on
    # disconnect or when Google revokes it; the calendar id outlives it while
    # that calendar may still be in their account, so reconnecting reuses it
    # rather than adding a second "The Belonging Collective".
    google_refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_calendar_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_connected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    password_hash: Mapped[str] = mapped_column(Text)
    # 'password' for every account that can sign in; 'icon' is legacy.
    auth_type: Mapped[str] = mapped_column(Text, default="password")
    # ARRAY(Text) not ARRAY(String): the DB columns are text[], and equality
    # filters (see _allocate_unique_icons) bind the literal with the column's
    # type — String binds varchar[], which has no `text[] = varchar[]` operator.
    icons: Mapped[list[str]] = mapped_column(ARRAY(Text))  # hidden allocation
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
    # sign in; their email is released (uq_users_email_live).
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
    def google_calendar(self) -> str:
        """'connected', 'available' (Google sign-in is configured, not yet
        used) or 'off' — what the calendar buttons offer this member."""
        if self.google_calendar_id and self.google_refresh_token:
            return "connected"
        if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
            return "available"
        return "off"

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
