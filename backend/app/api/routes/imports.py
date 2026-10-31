"""Import an existing calendar as events — superadmins only.

Two steps, so nothing is created that a person hasn't looked at:

- `POST /imports/calendar/preview` reads a calendar (a web address — a
  Teamup / Google / Outlook iCal feed — or an uploaded .ics file's text) and
  answers with one row per program: its dates, the platform organization its
  calendar organization matches, guessed topics, whether it's for a
  restricted audience, and a possible duplicate of an event already here.
  Nothing is written.
- `POST /imports/calendar/commit` takes the rows the superadmin kept (with
  their corrections) and creates them: one event per date, sharing a
  series_id, exactly like a repeating event made in the console.

See core/calendar_import.py for how a calendar is read.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.core import calendar_import as ci
from app.core.access import resolve_group_for_host
from app.core.categories import require_live_slugs
from app.models.category import Category
from app.models.event import Event
from app.models.host import Host
from app.schemas.event import DESCRIPTION_MAX, normalize_url

router = APIRouter(prefix="/imports", tags=["imports"])

MAX_PROGRAMS = 300


class PreviewIn(BaseModel):
    url: str | None = None
    # An uploaded .ics file's text, read in the browser.
    ics: str | None = Field(None, max_length=ci.MAX_BYTES)


class DateIn(BaseModel):
    starts_at: datetime
    ends_at: datetime | None = None


class LinkIn(BaseModel):
    label: str
    url: str


class ProgramIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    location: str | None = None
    who: str | None = None
    host_id: uuid.UUID
    categories: list[str] = Field(min_length=1)
    dates: list[DateIn] = Field(min_length=1, max_length=ci.MAX_DATES)
    recurrence: str | None = None
    links: list[LinkIn] = Field([], max_length=ci.LINKS_MAX)
    is_free: bool = True
    is_virtual: bool = False
    min_age: int | None = None
    access_group_id: uuid.UUID | None = None


class CommitIn(BaseModel):
    programs: list[ProgramIn] = Field(min_length=1, max_length=MAX_PROGRAMS)


def _restricted(who: str | None) -> bool:
    """'People who registered through LEG Up!' — an audience that signed up
    elsewhere, so the program may belong behind special access."""
    return bool(who and "register" in who.lower())


@router.post("/calendar/preview")
def preview(
    body: PreviewIn,
    _: Host = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.ics:
        data = body.ics.encode()
    elif body.url and body.url.strip():
        try:
            data = ci.fetch(body.url)
        except ci.ImportProblem as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    else:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Give the calendar's web address or upload its file."
        )
    try:
        programs = ci.parse(data)
    except ci.ImportProblem as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    orgs = [
        (str(h.id), h.name)
        for h in db.query(Host).filter(Host.org_id.is_(None), Host.deleted_at.is_(None)).all()
    ]
    live_topics = {
        slug for (slug,) in db.query(Category.slug).filter(Category.deleted_at.is_(None)).all()
    }
    # Events already here that a program might repeat: the same organization
    # (or any, when it has none yet), a similar title, and a shared day.
    existing = (
        db.query(Event.id, Event.host_id, Event.title, Event.starts_at)
        .filter(
            Event.deleted_at.is_(None),
            Event.starts_at >= datetime.now(timezone.utc) - timedelta(days=1),
        )
        .all()
    )
    by_title: dict[tuple, list] = {}
    for eid, hid, title, starts in existing:
        by_title.setdefault((str(hid), title), []).append((eid, starts))

    rows = []
    for p in programs:
        host_id = ci.match_org(p.org_label, orgs)
        duplicate = None
        days = {d.astimezone(ci.LOCAL).date() for d, _ in p.dates}
        for (hid, title), hits in by_title.items():
            if host_id and hid != host_id:
                continue
            if not ci.similar(p.title, title):
                continue
            hit = next((h for h in hits if h[1] and h[1].astimezone(ci.LOCAL).date() in days), None)
            if hit:
                duplicate = {"id": str(hit[0]), "title": title}
                break
        topics = ci.guess_topics(f"{p.title} {p.description}", live_topics)
        problems = []
        if not host_id:
            problems.append(
                f"“{p.org_label}” isn't an organization here" if p.org_label else "No organization"
            )
        if not topics:
            problems.append("Pick a topic")
        if duplicate:
            problems.append("Looks like it's already here")
        if p.is_free is None:
            problems.append("Cost not given — set to free")
        rows.append(
            {
                "key": p.key,
                "title": p.title,
                "description": p.description,
                "location": p.location,
                "who": p.who,
                "org_label": p.org_label,
                "host_id": host_id,
                "links": p.links,
                "is_free": p.is_free is not False,
                "is_virtual": p.is_virtual,
                "min_age": p.min_age,
                "categories": topics,
                "dates": [
                    {"starts_at": s.isoformat(), "ends_at": e.isoformat() if e else None}
                    for s, e in p.dates
                ],
                "recurrence": p.recurrence,
                "restricted": _restricted(p.who),
                "duplicate": duplicate,
                "problems": problems,
            }
        )
    return {"programs": rows, "organizations": [{"id": i, "name": n} for i, n in orgs]}


@router.post("/calendar/commit", status_code=status.HTTP_201_CREATED)
def commit(
    body: CommitIn,
    admin: Host = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create the reviewed programs. All or nothing: one bad row (an
    organization or topic that's gone, a group from another organization)
    refuses the whole import, so it can be fixed and run again without
    half of it already in."""
    orgs = {
        h.id: h
        for h in db.query(Host).filter(Host.org_id.is_(None), Host.deleted_at.is_(None)).all()
    }
    created_programs = 0
    created_events = 0
    for p in body.programs:
        if p.host_id not in orgs:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"“{p.title}”: that organization isn't on the platform."
            )
        require_live_slugs(db, p.categories)
        resolve_group_for_host(db, p.access_group_id, p.host_id)

        description = p.description.strip()
        notes_parts = []
        if p.who:
            notes_parts.append(f"Who: {p.who}")
        if len(description) > DESCRIPTION_MAX:
            # Keep all of it: what fits, and the rest under extra details.
            notes_parts.append(description[DESCRIPTION_MAX - 1 :].strip())
            description = description[: DESCRIPTION_MAX - 1].rstrip() + "…"
        dates = sorted(p.dates, key=lambda d: d.starts_at)
        series_id = uuid.uuid4()
        fields = dict(
            title=p.title.strip(),
            description=description,
            notes="\n\n".join(notes_parts) or None,
            categories=p.categories,
            category=p.categories[0],
            location=(p.location or "").strip() or None,
            is_free=p.is_free,
            pricing_model="free" if p.is_free else "custom",
            price_note=None if p.is_free else "See the event's links for the cost",
            is_virtual=p.is_virtual,
            min_age=p.min_age,
            requires_signup=False,
            registration_mode="internal",
            registration_url=None,
            links=[
                {"label": link.label.strip()[:80] or "Link", "url": normalize_url(link.url)}
                for link in p.links
            ],
            accessibility_tags=(["free"] if p.is_free else []) + ["no_registration"],
            access_group_id=p.access_group_id,
            host_id=p.host_id,
            created_by_host_id=admin.id,
            series_id=series_id,
            recurrence=p.recurrence if len(dates) > 1 else None,
            series_total=len(dates),
        )
        for index, d in enumerate(dates, start=1):
            db.add(
                Event(
                    **fields,
                    starts_at=d.starts_at,
                    ends_at=d.ends_at,
                    series_index=index,
                )
            )
            created_events += 1
        created_programs += 1
    db.commit()
    return {"programs": created_programs, "events": created_events}
