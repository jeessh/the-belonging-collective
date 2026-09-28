"""Slugs for topics, and the one check every write of a topic goes through."""

import re

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.category import Category


def slugify(label: str) -> str:
    """"Arts & Crafts" → "arts-crafts". Lowercase ASCII words joined by hyphens."""
    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    return slug or "topic"


def live_slugs(db: Session) -> set[str]:
    return {
        slug
        for (slug,) in db.query(Category.slug)
        .filter(Category.deleted_at.is_(None))
        .all()
    }


def require_live_slugs(db: Session, slugs: list[str]) -> None:
    """400 unless every slug is a live topic.

    Interest matching is slug equality, so a value that isn't in the table can
    never match anyone — refusing it here is what keeps the picker the only way
    a topic gets onto a program or a profile.
    """
    unknown = sorted(set(slugs) - live_slugs(db))
    if unknown:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unknown topic(s): {', '.join(unknown)}",
        )
