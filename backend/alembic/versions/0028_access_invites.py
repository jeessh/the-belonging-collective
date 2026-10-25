"""Organizations add people to special-access groups by email.

`access_invites`: an address an organization added to one of its groups
before that address had a member account. There is no approval step — the
organization chose them — so the row becomes an approved membership as soon
as an account is made with that email. Addresses that already have an
account are approved straight away and never get a row. Withdrawn and used
rows are stamped (`revoked_at`, `accepted_at`), never deleted.

Additive: a new table only, so the deployed code keeps working against the
migrated database until the release that uses it ships.

Revision ID: 0028_access_invites
Revises: 0027_care_invites
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0028_access_invites"
down_revision = "0027_care_invites"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "access_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("access_groups.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column(
            "invited_by_host_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hosts.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "accepted_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "uq_access_invites_group_email_live",
        "access_invites",
        ["group_id", sa.text("lower(email)")],
        unique=True,
        postgresql_where=sa.text("accepted_at IS NULL AND revoked_at IS NULL"),
    )
    op.create_index(
        "ix_access_invites_email", "access_invites", [sa.text("lower(email)")]
    )


def downgrade() -> None:
    op.drop_index("ix_access_invites_email", table_name="access_invites")
    op.drop_index("uq_access_invites_group_email_live", table_name="access_invites")
    op.drop_table("access_invites")
