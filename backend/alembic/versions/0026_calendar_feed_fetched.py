"""When a calendar last fetched the member's feed.

`users.calendar_feed_fetched_at`: stamped when Google (or any calendar app)
fetches GET /calendar/{token}.ics. A recent fetch means the feed is already
subscribed, so the "Google Calendar" button opens Google Calendar instead of
Google's "Add calendar" page again — pressing it twice shouldn't leave the
member with the same calendar listed twice.

Additive and nullable, so the deployed code keeps working against the
migrated table until the release that reads it ships.

Revision ID: 0026_calendar_feed_fetched
Revises: 0025_google_calendar
"""

import sqlalchemy as sa
from alembic import op

revision = "0026_calendar_feed_fetched"
down_revision = "0025_google_calendar"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("calendar_feed_fetched_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "calendar_feed_fetched_at")
