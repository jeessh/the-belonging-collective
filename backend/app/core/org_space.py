"""An organization's own space: /o/{slug}, the feed with only its programs.

Each organization row gets a slug from its name when it is made (and the
migration gave existing ones theirs). `in_shared_feed` decides whether its
programs also appear in the shared feed; either way they are always in its
own space, and every by-id route still serves them, so links and QR codes
work wherever the program is listed.
"""

import re

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.host import Host


def _base(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:60].strip("-") or "organization"


def unique_slug(db: Session, name: str) -> str:
    """A slug for a new organization: from its name, suffixed if taken.
    Archived organizations keep theirs, so an old link never lands on a
    different organization."""
    base = _base(name)
    taken = {
        s
        for (s,) in db.query(Host.slug)
        .filter(Host.slug.is_not(None), func.lower(Host.slug).like(f"{base}%"))
        .all()
    }
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


def org_by_slug(db: Session, slug: str) -> Host | None:
    return (
        db.query(Host)
        .filter(
            func.lower(Host.slug) == slug.lower(),
            Host.org_id.is_(None),
            Host.deleted_at.is_(None),
        )
        .first()
    )
