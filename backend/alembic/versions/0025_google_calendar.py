"""Connected Google Calendar per member.

`users.google_refresh_token` (encrypted), `users.google_calendar_id` and
`users.google_connected_at`: a member who connects Google Calendar gets a
"The Belonging Collective" calendar in their account that core/gcal.py keeps
matching their saved list.

Additive and nullable, so the deployed code keeps working against the
migrated table until the release that reads them ships.

Revision ID: 0025_google_calendar
Revises: 0024_calendar_feed
"""

import sqlalchemy as sa
from alembic import op

revision = "0025_google_calendar"
down_revision = "0024_calendar_feed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_refresh_token", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("google_calendar_id", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column("google_connected_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "google_connected_at")
    op.drop_column("users", "google_calendar_id")
    op.drop_column("users", "google_refresh_token")
