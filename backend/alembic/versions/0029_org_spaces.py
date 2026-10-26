"""Organizations' own spaces: a slug for /o/{slug}, and whether their
programs also show in the shared feed.

- `hosts.slug`: organization rows only; unique (case-insensitively) over all
  rows, archived included, so an old link never lands on a different
  organization. Existing organizations get one from their name here.
- `hosts.in_shared_feed`: default true, so every existing organization keeps
  showing in the shared feed exactly as before.
- `host_invites.in_shared_feed`: the choice made when inviting an
  organization, carried until it accepts.

Additive with defaults, so the deployed code keeps working against the
migrated database until the release that uses it ships.

Revision ID: 0029_org_spaces
Revises: 0028_access_invites
"""

import re

import sqlalchemy as sa
from alembic import op

revision = "0029_org_spaces"
down_revision = "0028_access_invites"
branch_labels = None
depends_on = None


def _base(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return slug[:60].strip("-") or "organization"


def upgrade() -> None:
    op.add_column("hosts", sa.Column("slug", sa.Text(), nullable=True))
    op.add_column(
        "hosts",
        sa.Column(
            "in_shared_feed", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
    )
    op.add_column(
        "host_invites",
        sa.Column(
            "in_shared_feed", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
    )

    # Existing organizations (not staff logins), oldest first, so the first
    # of two same-named agencies keeps the plain slug.
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, name FROM hosts WHERE org_id IS NULL ORDER BY created_at, id"
        )
    ).fetchall()
    taken: set[str] = set()
    for host_id, name in rows:
        base = _base(name)
        slug, n = base, 2
        while slug in taken:
            slug = f"{base}-{n}"
            n += 1
        taken.add(slug)
        conn.execute(
            sa.text("UPDATE hosts SET slug = :slug WHERE id = :id"),
            {"slug": slug, "id": host_id},
        )

    op.create_index(
        "uq_hosts_slug",
        "hosts",
        [sa.text("lower(slug)")],
        unique=True,
        postgresql_where=sa.text("slug IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_hosts_slug", table_name="hosts")
    op.drop_column("host_invites", "in_shared_feed")
    op.drop_column("hosts", "in_shared_feed")
    op.drop_column("hosts", "slug")
