"""A private calendar feed per member.

`users.calendar_token`: the handle behind GET /calendar/{token}.ics, which
Google Calendar (or Apple, Outlook) subscribes to so every saved program
lands in the member's calendar and follows later saves. Separate from
`share_token` on purpose: the share link is public and leaves special-access
programs out; this feed is the member's whole saved list.

Additive and nullable, so the deployed code keeps working against the
migrated table until the release that reads it ships.

Revision ID: 0024_calendar_feed
Revises: 0023_member_password_resets
"""

import sqlalchemy as sa
from alembic import op

revision = "0024_calendar_feed"
down_revision = "0023_member_password_resets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("calendar_token", sa.Text(), nullable=True))
    op.create_index(
        "uq_users_calendar_token", "users", ["calendar_token"], unique=True
    )


def downgrade() -> None:
    op.drop_index("uq_users_calendar_token", table_name="users")
    op.drop_column("users", "calendar_token")
