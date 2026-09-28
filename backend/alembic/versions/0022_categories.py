"""Topics move into the database, and stored topics become slugs.

Until now a topic was a label string on `events.category`,
`events.categories` and `users.interest_categories`, and matching was string
equality — so the first rename would have silently broken every match. Each
topic now has a stable slug (the `categories` table's key) and a display
label a superadmin may change; the three columns store the slug.

The upgrade rewrites every stored label to its slug, matched case- and
whitespace-insensitively against the seed list, which is today's `CATEGORIES`
in frontend/lib/categories.ts. A value that matches no label is left exactly
as it was (the archived demo programming's "Advice", "Arts", "Hangout",
"Food") and reported, so nothing is re-filed by guesswork. Re-running the
upgrade — or running it against a database that already holds slugs — changes
nothing: a slug matches no label, or (for one-word topics) only its own.

Revision ID: 0022_categories
Revises: 0021_caregivers
"""

import sqlalchemy as sa
from alembic import op

revision = "0022_categories"
down_revision = "0021_caregivers"
branch_labels = None
depends_on = None

# (slug, label), in the order the pickers show them.
SEED = [
    ("education", "Education"),
    ("social", "Social"),
    ("recreation", "Recreation"),
    ("support-group", "Support Group"),
    ("cooking", "Cooking"),
    ("fundraising", "Fundraising"),
    ("youth-programs", "Youth Programs"),
    ("wellness", "Wellness"),
    ("fitness", "Fitness"),
    ("arts-crafts", "Arts & Crafts"),
    ("music", "Music"),
    ("games", "Games"),
    ("sports", "Sports"),
]

# Every column that stores a topic: (table, column, is_array).
COLUMNS = [
    ("events", "category", False),
    ("events", "categories", True),
    ("users", "interest_categories", True),
]


def _rewrite(mapping: list[tuple[str, str]]) -> None:
    """Replace each `old` with `new` in every topic column.

    Matched on lower(trim(value)) = lower(old), so a stray space or a
    differently-cased label still maps; anything that matches nothing is
    left exactly as it was. Array order is preserved.
    """
    conn = op.get_bind()
    for old, new in mapping:
        for table, column, is_array in COLUMNS:
            if is_array:
                sql = (
                    f"UPDATE {table} SET {column} = ("
                    f"  SELECT array_agg(CASE WHEN lower(trim(c)) = lower(:old) "
                    f"                        THEN CAST(:new AS text) ELSE c END ORDER BY ord)"
                    f"  FROM unnest({column}) WITH ORDINALITY AS u(c, ord)"
                    f") WHERE EXISTS ("
                    f"  SELECT 1 FROM unnest({column}) AS c WHERE lower(trim(c)) = lower(:old)"
                    f")"
                )
            else:
                sql = (
                    f"UPDATE {table} SET {column} = :new "
                    f"WHERE lower(trim({column})) = lower(:old)"
                )
            conn.execute(sa.text(sql), {"old": old, "new": new})


def _report_unknown(known: set[str], what: str) -> None:
    """Print the stored values that matched nothing, so nobody has to go looking."""
    conn = op.get_bind()
    for table, column, is_array in COLUMNS:
        expr = f"unnest({column})" if is_array else column
        rows = conn.execute(
            sa.text(
                f"SELECT v, count(*) FROM (SELECT {expr} AS v FROM {table}) s "
                "WHERE v IS NOT NULL GROUP BY v ORDER BY v"
            )
        ).all()
        unknown = [(v, n) for v, n in rows if v not in known]
        if unknown:
            print(
                f"[0022_categories] {table}.{column}: values that are not a {what}, "
                "kept as-is: " + ", ".join(f"{v!r} x{n}" for v, n in unknown)
            )


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS categories (
            slug        TEXT PRIMARY KEY,
            label       TEXT NOT NULL,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at  TIMESTAMPTZ
        )
        """
    )
    conn = op.get_bind()
    for order, (slug, label) in enumerate(SEED):
        conn.execute(
            sa.text(
                "INSERT INTO categories (slug, label, sort_order) "
                "VALUES (:slug, :label, :order) ON CONFLICT (slug) DO NOTHING"
            ),
            {"slug": slug, "label": label, "order": order},
        )
    # label → slug
    _rewrite([(label, slug) for slug, label in SEED])
    _report_unknown({slug for slug, _ in SEED}, "topic slug")


def downgrade() -> None:
    conn = op.get_bind()
    # Map back through the table, not the seed list, so a topic added since
    # goes back to its own label rather than being stranded as a slug.
    rows = conn.execute(sa.text("SELECT slug, label FROM categories")).all()
    _rewrite([(slug, label) for slug, label in rows])
    _report_unknown({label for _, label in rows}, "topic label")
    op.drop_table("categories")
