"""Caregiver accounts and care links.

`users.is_caregiver`: the account belongs to somebody who supports a member
(a parent, a support worker). Support, not proxy — the member keeps their own
account and their own credential; this flag only opens the caregiver tools.

`care_links`: which caregiver supports which member. Removing a link sets
`removed_at`; the row is never deleted, and re-linking clears it again. FKs
are RESTRICT like every other relation on users.

Revision ID: 0021_caregivers
Revises: 0020_holds_profile_sharing
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0021_caregivers"
down_revision = "0020_holds_profile_sharing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_caregiver",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_table(
        "care_links",
        sa.Column(
            "caregiver_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column(
            "member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
    )
    # The PK serves "who does this caregiver support"; this serves the other
    # direction — "who supports this member" — for /auth/me and reminders.
    op.create_index("ix_care_links_member", "care_links", ["member_id"])


def downgrade() -> None:
    op.drop_index("ix_care_links_member", table_name="care_links")
    op.drop_table("care_links")
    op.drop_column("users", "is_caregiver")
