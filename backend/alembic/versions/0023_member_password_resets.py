"""Password resets for member accounts.

Icon keys are retired: members sign in with an email and a password, so they
need the same self-service reset organizers have (0014). Additive only —
`users.icons` and its unique constraint stay as an internal allocation.

Revision ID: 0023_member_password_resets
Revises: 0022_categories
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0023_member_password_resets"
down_revision = "0022_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "member_password_resets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("token_hash", sa.Text(), nullable=False, unique=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        if_not_exists=True,
    )
    op.create_index(
        "ix_member_password_resets_user_id",
        "member_password_resets",
        ["user_id"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_member_password_resets_user_id", "member_password_resets")
    op.drop_table("member_password_resets")
