"""Member view prefs, dismissed recommendations, onboarding, posters, special access.

`users.preferred_view` (card | list) is how the member last chose to see the
feed; the value set is enforced by the schema, as for `auth_type`.
`users.dismissed_program_ids` holds the recommendations they waved away — a
program id is the event's `series_id` when it has one, else its `id`.
`users.onboarded_at` is stamped when the first-run tour has been seen.

`events.poster_url` is the agency's own flyer (PDF or image), uploaded via
POST /events/posters into the same bucket as cover images.

Special access: `access_groups` are per-organization ("Karis — residential"),
`access_memberships` is a member's standing with one group (requested |
approved | declined | revoked), and `events.access_group_id` restricts a
program to that group's approved members. Null = public. Every FK is
RESTRICT — nothing here is deleted, groups are archived — and the group name
is unique per host over live rows only, case-insensitively, like
`uq_hosts_email_live`.

Everything is additive with defaults or nullable, so the deployed code keeps
working against the migrated table until the release that reads them ships.

Revision ID: 0018_view_prefs_event_posters
Revises: 0017_member_email_event_links
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0018_view_prefs_event_posters"
down_revision = "0017_member_email_event_links"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- member preferences ---
    op.add_column(
        "users",
        sa.Column(
            "preferred_view",
            sa.Text(),
            server_default=sa.text("'card'"),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "dismissed_program_ids",
            postgresql.ARRAY(sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column("onboarded_at", sa.DateTime(timezone=True), nullable=True),
    )

    # --- posters ---
    op.add_column("events", sa.Column("poster_url", sa.Text(), nullable=True))

    # --- special access ---
    op.create_table(
        "access_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("host_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["host_id"], ["hosts.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_access_groups_host_name_live "
        "ON access_groups (host_id, lower(name)) WHERE deleted_at IS NULL"
    )
    op.create_table(
        "access_memberships",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column(
            "requested_via_event_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_by_host_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["group_id"], ["access_groups.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["requested_via_event_id"], ["events.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["decided_by_host_id"], ["hosts.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("user_id", "group_id"),
    )
    op.create_index(
        "ix_access_memberships_group", "access_memberships", ["group_id", "status"]
    )
    op.add_column(
        "events",
        sa.Column("access_group_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "events_access_group_id_fkey",
        "events",
        "access_groups",
        ["access_group_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_events_access_group", "events", ["access_group_id"])


def downgrade() -> None:
    op.drop_index("ix_events_access_group", table_name="events")
    op.drop_constraint("events_access_group_id_fkey", "events", type_="foreignkey")
    op.drop_column("events", "access_group_id")
    op.drop_index("ix_access_memberships_group", table_name="access_memberships")
    op.drop_table("access_memberships")
    op.execute("DROP INDEX IF EXISTS uq_access_groups_host_name_live")
    op.drop_table("access_groups")
    op.drop_column("events", "poster_url")
    op.drop_column("users", "onboarded_at")
    op.drop_column("users", "dismissed_program_ids")
    op.drop_column("users", "preferred_view")
