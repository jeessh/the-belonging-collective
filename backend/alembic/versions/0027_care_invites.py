"""Members invite their own caregivers.

`care_invites`: a member names an email; whoever signs in with that email
and accepts becomes linked as the member's caregiver. The token is stored
only as a SHA-256 hash, like `host_invites`. Accepted and withdrawn
invitations are stamped (`accepted_at`, `revoked_at`), never deleted. FKs to
users are RESTRICT like every other relation on users.

Additive: a new table only, so the deployed code keeps working against the
migrated database until the release that uses it ships.

Revision ID: 0027_care_invites
Revises: 0026_calendar_feed_fetched
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0027_care_invites"
down_revision = "0026_calendar_feed_fetched"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "care_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("token_hash", sa.Text(), nullable=False, unique=True),
        sa.Column(
            "member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "accepted_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_care_invites_member", "care_invites", ["member_id"])


def downgrade() -> None:
    op.drop_index("ix_care_invites_member", table_name="care_invites")
    op.drop_table("care_invites")
