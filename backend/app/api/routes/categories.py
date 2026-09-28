"""Topics: read by everyone, managed by superadmins.

A topic's slug is minted once and never changes; renaming touches only the
label. Archiving a topic that programs still use needs somewhere to put them,
and the move — programs and members' interests alike — happens in the same
transaction as the archive, so nothing is ever left pointing at a topic that
no longer exists.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.core.categories import slugify
from app.models.category import Category
from app.models.event import Event
from app.models.host import Host
from app.models.user import User
from app.schemas.category import (
    CategoryArchived,
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
)

router = APIRouter(prefix="/categories", tags=["categories"])


def _live(db: Session, slug: str) -> Category:
    row = db.get(Category, slug)
    if not row or row.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Topic not found")
    return row


def _events_using(db: Session, slug: str):
    return db.query(Event).filter(
        Event.deleted_at.is_(None), Event.categories.any(slug)
    )


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    rows = (
        db.query(Category)
        .filter(Category.deleted_at.is_(None))
        .order_by(Category.sort_order.asc(), Category.label.asc())
        .all()
    )
    counts = dict(
        db.execute(
            text(
                "SELECT c, count(*) FROM events, unnest(categories) AS c "
                "WHERE deleted_at IS NULL GROUP BY c"
            )
        ).all()
    )
    out = []
    for row in rows:
        item = CategoryOut.model_validate(row)
        item.event_count = counts.get(row.slug, 0)
        out.append(item)
    return out


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    body: CategoryCreate,
    _: Host = Depends(require_admin),
    db: Session = Depends(get_db),
):
    # Archived slugs stay taken: an old program filed under "arts" must not be
    # re-read as a topic somebody created later. Suffix until it's free.
    base = slugify(body.label)
    slug, n = base, 1
    while db.get(Category, slug) is not None:
        n += 1
        slug = f"{base}-{n}"
    last = db.query(func.max(Category.sort_order)).scalar()
    row = Category(slug=slug, label=body.label, sort_order=(last or 0) + 1)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{slug}", response_model=CategoryOut)
def update_category(
    slug: str,
    body: CategoryUpdate,
    _: Host = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = _live(db, slug)
    if body.label is not None:
        row.label = body.label
    if body.sort_order is not None:
        row.sort_order = body.sort_order
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{slug}", response_model=CategoryArchived)
def archive_category(
    slug: str,
    reassign_to: str | None = Query(None),
    _: Host = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Archive a topic, moving whatever used it to `reassign_to`.

    Required when live programs carry the slug; the 409 says how many so the
    console can ask. Members' interests move too (or drop the slug when there is
    nowhere to move it), so a profile never holds a topic the picker can't show.
    """
    row = _live(db, slug)
    if reassign_to == slug:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pick a different topic.")
    if reassign_to is not None:
        _live(db, reassign_to)
    affected_events = _events_using(db, slug).count()
    if affected_events and reassign_to is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{affected_events} live program(s) use this topic. "
            "Choose a topic to move them to.",
        )
    members = (
        db.query(User)
        .filter(User.deleted_at.is_(None), User.interest_categories.any(slug))
        .all()
    )
    for event in _events_using(db, slug).all():
        event.categories = _moved(event.categories, slug, reassign_to)
        event.category = event.categories[0] if event.categories else None
    for member in members:
        member.interest_categories = _moved(member.interest_categories, slug, reassign_to)
    row.deleted_at = func.now()
    db.commit()
    return CategoryArchived(
        slug=slug,
        reassigned_to=reassign_to,
        affected_events=affected_events,
        affected_members=len(members),
    )


def _moved(slugs: list[str], old: str, new: str | None) -> list[str]:
    """`old` replaced by `new` (or dropped when None), order kept, no repeats —
    a program already filed under both topics keeps one entry, in its place."""
    out: list[str] = []
    for s in slugs:
        s = new if s == old else s
        if s is not None and s not in out:
            out.append(s)
    return out
