"""Member email accounts and important links on events.

A member may now sign in with an email and password instead of the icon key.
`users.email` identifies those accounts, so it is unique over live rows only
— the same partial-index rule as `uq_hosts_email_live`, so an archived member
releases the address. Compared case-insensitively; writes lowercase it anyway.

`events.links` holds up to three `{label, url}` pairs an organizer wants shown
alongside the program. The registration link stays in `registration_url`.

Revision ID: 0017_member_email_event_links
Revises: 0016_backfill_derived_tags
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0017_member_email_event_links"
down_revision = "0016_backfill_derived_tags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.Text(), nullable=True))
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_live "
        "ON users (lower(email)) "
        "WHERE email IS NOT NULL AND deleted_at IS NULL"
    )
    op.add_column(
        "events",
        sa.Column(
            "links",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("events", "links")
    op.execute("DROP INDEX IF EXISTS uq_users_email_live")
    op.drop_column("users", "email")
