"""Spot holds, reminders, member profile pictures, shareable saved lists.

`event_attendees.held_until`: saving a program with a capacity holds the
member's spot for one hour when the active holds are under capacity. Null
means saved without a hold (no capacity, no spots left, or the hour is up).
`event_attendees.reminded_at`: when the day-before reminder went out.

`users.avatar_url` / `users.avatar_emblem`: a photo or an emblem, never both.
`users.share_token`: the public handle behind GET /shared/{token}.

Everything is additive and nullable, so the deployed code keeps working
against the migrated table until the release that reads them ships.

Revision ID: 0020_holds_profile_sharing
Revises: 0019_staff_logins
"""

import sqlalchemy as sa
from alembic import op

revision = "0020_holds_profile_sharing"
down_revision = "0019_staff_logins"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "event_attendees",
        sa.Column("held_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "event_attendees",
        sa.Column("reminded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("users", sa.Column("avatar_url", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("avatar_emblem", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("share_token", sa.Text(), nullable=True))
    op.create_index(
        "uq_users_share_token", "users", ["share_token"], unique=True
    )


def downgrade() -> None:
    op.drop_index("uq_users_share_token", table_name="users")
    op.drop_column("users", "share_token")
    op.drop_column("users", "avatar_emblem")
    op.drop_column("users", "avatar_url")
    op.drop_column("event_attendees", "reminded_at")
    op.drop_column("event_attendees", "held_until")
