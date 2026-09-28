"""Staff logins under an organization, and who created each program.

`hosts.org_id` — null for an organization's own (shared) login, as every row
was before this; set for a staff login belonging to that organization. The
organization stays the owner of everything: programs, groups and invites keep
pointing at the org row, and a staff login's access level is its
organization's `is_admin`. See `org_id_of` in app/models/host.py.

`events.created_by_host_id` — the login that posted the program, for
attribution now that more than one person can act for an organization.
Backfilled to the owner, which is who created everything until now.

`host_invites.org_id` / `host_invites.name` — an invitation to join an
existing organization as a staff login, rather than to found a new one.

All RESTRICT: nothing is deleted, and a stray DELETE must fail loudly.

Revision ID: 0019_staff_logins
Revises: 0018_view_prefs_event_posters
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0019_staff_logins"
down_revision = "0018_view_prefs_event_posters"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "hosts", sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "hosts_org_id_fkey", "hosts", "hosts", ["org_id"], ["id"], ondelete="RESTRICT"
    )
    op.create_index("ix_hosts_org", "hosts", ["org_id"])

    op.add_column(
        "events",
        sa.Column("created_by_host_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "events_created_by_host_id_fkey",
        "events",
        "hosts",
        ["created_by_host_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.execute("UPDATE events SET created_by_host_id = host_id WHERE created_by_host_id IS NULL")

    op.add_column(
        "host_invites",
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("host_invites", sa.Column("name", sa.Text(), nullable=True))
    op.create_foreign_key(
        "host_invites_org_id_fkey",
        "host_invites",
        "hosts",
        ["org_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint("host_invites_org_id_fkey", "host_invites", type_="foreignkey")
    op.drop_column("host_invites", "name")
    op.drop_column("host_invites", "org_id")
    op.drop_constraint("events_created_by_host_id_fkey", "events", type_="foreignkey")
    op.drop_column("events", "created_by_host_id")
    op.drop_index("ix_hosts_org", table_name="hosts")
    op.drop_constraint("hosts_org_id_fkey", "hosts", type_="foreignkey")
    op.drop_column("hosts", "org_id")
