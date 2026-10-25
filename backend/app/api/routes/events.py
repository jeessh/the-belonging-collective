import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import (
    get_current_host,
    get_db,
    get_optional_host,
    get_optional_user,
)
from app.core import gcal, holds, ical, member_mail
from app.core.categories import require_live_slugs
from app.core.storage import StorageError, upload_image
from app.core.org_space import org_by_slug
from app.core.access import (
    NONE,
    membership_statuses,
    resolve_group_for_host,
    scope_to_viewer,
)
from app.models.event import Event
from app.models.event_image import EventImage
from app.models.click import RegistrationClick
from app.models.host import Host, org_id_of
from app.models.user import User
from app.core.recurrence import RecurrenceError, describe as describe_recurrence
from app.core.recurrence import occurrences
from app.schemas.event import (
    EventCreate,
    EventOut,
    EventUpdate,
    validate_numbers,
    validate_pricing,
    validate_registration,
)

router = APIRouter(prefix="/events", tags=["events"])

# Cover + gallery uploads accept these; must match the bucket's allowed types.
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
# A poster is the agency's own flyer, so PDF joins the two photo formats. Capped
# under Vercel's 4.5 MB request body limit, which would otherwise reject the
# request before this code ever saw it.
ALLOWED_POSTER_TYPES = {"application/pdf", "image/png", "image/jpeg"}
MAX_POSTER_BYTES = 4 * 1024 * 1024  # 4 MB
_READ_CHUNK = 64 * 1024


def _sniff_file_type(head: bytes) -> str | None:
    """Actual file type from magic bytes; the client's header is untrusted."""
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return "image/webp"
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    return None


async def _store_upload(
    file: UploadFile, allowed: set[str], max_bytes: int, too_large: str, wrong_type: str
) -> str:
    """Read, cap, sniff and store one uploaded file; return its public URL."""
    # Read in chunks so the size cap is enforced during the read, not after
    # the whole body is already buffered.
    data = bytearray()
    while chunk := await file.read(_READ_CHUNK):
        data.extend(chunk)
        if len(data) > max_bytes:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, too_large)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file is empty.")

    content_type = _sniff_file_type(bytes(data[:16]))
    if content_type not in allowed:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, wrong_type)

    try:
        return await upload_image(bytes(data), content_type)
    except StorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc


@router.post("/images", status_code=status.HTTP_201_CREATED)
async def upload_event_image(
    file: UploadFile = File(...),
    _host: Host = Depends(get_current_host),  # host-only
):
    """Upload a cover/gallery image and return its public URL.

    The frontend uploads on drop/select, then stores the returned URL on the
    event via the normal create/patch flow — no schema change.
    """
    url = await _store_upload(
        file,
        ALLOWED_IMAGE_TYPES,
        MAX_IMAGE_BYTES,
        "Image is too large (max 5 MB).",
        "Please choose a PNG, JPEG, WebP, or GIF image.",
    )
    return {"url": url}


@router.post("/posters", status_code=status.HTTP_201_CREATED)
async def upload_event_poster(
    file: UploadFile = File(...),
    _host: Host = Depends(get_current_host),  # host-only
):
    """Upload a program poster (the agency's flyer) and return its public URL.

    Stored on the event as `poster_url` through the normal create/patch flow,
    the same way a cover image is.
    """
    url = await _store_upload(
        file,
        ALLOWED_POSTER_TYPES,
        MAX_POSTER_BYTES,
        "Poster is too large (max 4 MB).",
        "Please choose a PDF, PNG, or JPEG poster.",
    )
    return {"url": url}


def _owns_or_admin(host: Host, event: Event) -> bool:
    return host.is_superadmin or event.host_id == org_id_of(host)


# NOT NULL on the events table, so a PATCH may omit them but never null them.
_REQUIRED_FIELDS = frozenset(
    {
        "title",
        "description",
        "accessibility_tags",
        "is_free",
        "requires_signup",
        "registration_mode",
        "pricing_model",
        "event_no",
        "links",
    }
)

# What a program's entry in a member's Google Calendar is made of (core/gcal).
_CALENDAR_FIELDS = ("title", "description", "location", "is_virtual", "starts_at", "ends_at")


# Eager loads for EventOut serialization (host_name + images); without these
# each serialized row lazy-loads per-relation (N+1 through pgbouncer).
_EVENT_OUT_OPTIONS = (
    joinedload(Event.host),
    joinedload(Event.access_group),
    selectinload(Event.images),
    # Powers EventOut.saved_count without a query per row.
    selectinload(Event.attendees),
)


def _public_view(
    db: Session, rows: list[Event], viewer: User | None, organizer: Host | None
) -> list[EventOut]:
    """Serialize for a public route. "N going" is for people who are signed
    in — a member or an organizer — so anonymous visitors get null, not 0.

    A signed-in member also learns where they stand with each restricted
    program's group (`access_status`), so the page can offer "request access"
    or say the request is in — one query for the whole page, not one per row.
    """
    out = [EventOut.model_validate(row) for row in rows]
    holds.annotate(rows, out, viewer.id if viewer else None)
    if not (viewer or organizer):
        for item in out:
            item.saved_count = None
    if organizer and rows:
        # Registration-link clicks, for the console's "N going · M clicks".
        # One grouped query for the page; members never see this number.
        clicks = dict(
            db.query(RegistrationClick.event_id, func.count(RegistrationClick.id))
            .filter(RegistrationClick.event_id.in_([row.id for row in rows]))
            .group_by(RegistrationClick.event_id)
            .all()
        )
        for row, item in zip(rows, out):
            item.click_count = clicks.get(row.id, 0)
    if viewer:
        statuses = membership_statuses(
            db, viewer.id, {row.access_group_id for row in rows if row.access_group_id}
        )
        for row, item in zip(rows, out):
            if row.access_group_id:
                item.access_status = statuses.get(row.access_group_id, NONE)
    return out


def _live_event(db: Session, event_id: uuid.UUID) -> Event:
    event = (
        db.query(Event)
        .options(*_EVENT_OUT_OPTIONS)
        .filter(Event.id == event_id, Event.deleted_at.is_(None))
        .first()
    )
    if not event:
        # Said differently, so the console can tell "un-published" from a
        # link that never pointed anywhere. Still a 404 for both: the public
        # page treats either as gone.
        archived = db.query(Event.id).filter(Event.id == event_id).first()
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "That event isn't published any more."
            if archived
            else "We couldn't find that event.",
        )
    return event


@router.get("", response_model=list[EventOut])
def list_events(
    category: str | None = None,
    tag: str | None = None,
    free: bool | None = None,
    q: str | None = None,
    org: str | None = None,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    viewer: User | None = Depends(get_optional_user),
    organizer: Host | None = Depends(get_optional_host),
    db: Session = Depends(get_db),
):
    """Public discovery feed with needs + accessibility filters.

    `org` (a slug) is an organization's own space: only its programs. Without
    it, the shared feed — every organization that shows there
    (`in_shared_feed`)."""
    query = db.query(Event).options(*_EVENT_OUT_OPTIONS).filter(
        Event.deleted_at.is_(None)
    )
    if org:
        space = org_by_slug(db, org)
        if space is None:
            return []
        query = query.filter(Event.host_id == space.id)
    else:
        own_space_only = select(Host.id).where(Host.in_shared_feed.is_(False))
        query = query.filter(Event.host_id.not_in(own_space_only))
    # Special-access programs are listed only to who may see them; every by-id
    # route below still serves them, so a link or QR code on a flyer works.
    query = scope_to_viewer(query, viewer, organizer)
    if category:
        query = query.filter(Event.category == category)
    if free is not None:
        query = query.filter(Event.is_free == free)
    if tag:
        query = query.filter(Event.accessibility_tags.any(tag))
    if q:
        query = query.filter(Event.title.ilike(f"%{q}%"))
    # Chronological, with stable tiebreakers so the order is deterministic
    # across requests. Without these, events sharing a starts_at (or both
    # undated → NULL) come back in arbitrary, varying order — which reads as the
    # feed being "out of order sometimes". created_at then id break ties.
    rows = (
        query.order_by(
            Event.starts_at.asc().nullslast(),
            Event.created_at.asc(),
            Event.id.asc(),
        )
        .limit(limit)
        .offset(offset)
        .all()
    )
    return _public_view(db, rows, viewer, organizer)


@router.get("/archived", response_model=list[EventOut])
def list_archived_events(
    host: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    """The console's "Un-published" list: what can still be restored.

    Your own organization's archived programs; every organization's for a
    superadmin, who can un-publish anyone's. Programs archived along with a
    removed organizer are left out — restore refuses those (409).
    """
    query = (
        db.query(Event)
        .options(*_EVENT_OUT_OPTIONS)
        .join(Host, Event.host_id == Host.id)
        .filter(Event.deleted_at.is_not(None), Host.deleted_at.is_(None))
    )
    if not host.is_superadmin:
        query = query.filter(Event.host_id == org_id_of(host))
    rows = (
        query.order_by(Event.deleted_at.desc(), Event.starts_at.asc().nullslast())
        .limit(1000)
        .all()
    )
    return _public_view(db, rows, None, host)


@router.get("/{event_id}", response_model=EventOut)
def get_event(
    event_id: uuid.UUID,
    viewer: User | None = Depends(get_optional_user),
    organizer: Host | None = Depends(get_optional_host),
    db: Session = Depends(get_db),
):
    event = _live_event(db, event_id)
    return _public_view(db, [event], viewer, organizer)[0]


@router.get("/{event_id}/calendar.ics")
def event_calendar(event_id: uuid.UUID, db: Session = Depends(get_db)):
    """The program as a calendar file. Public, like the page it sits on."""
    event = _live_event(db, event_id)
    if not event.starts_at:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "This program has no date to add."
        )
    return Response(
        ical.build([event]),
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="program-{event.event_no}.ics"'
        },
    )


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    body: EventCreate,
    host: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    """Create the program — or, if it repeats, every dated occurrence of it.

    Occurrences are real rows sharing a series_id rather than a rule expanded on
    read, because capacity, saves and reminders all attach to a specific date.
    The first occurrence is returned, since that's the one the console lands on.
    """
    data = body.model_dump(
        exclude={
            "gallery",
            "frequency",
            "occurrence_count",
            "repeat_until",
            "repeat_forever",
        }
    )
    # Programs belong to the organization, whichever of its logins posts them;
    # `created_by_host_id` records which one did.
    org_id = org_id_of(host)
    # Every occurrence of the series is restricted the same way — `data` is
    # copied into each row below.
    resolve_group_for_host(db, body.access_group_id, org_id)
    require_live_slugs(db, body.categories)
    starts_at = data.get("starts_at")

    if body.frequency and body.frequency != "once":
        if not starts_at:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "A repeating program needs a first date.",
            )
        try:
            dates = occurrences(
                starts_at,
                body.frequency,
                count=body.occurrence_count,
                until=body.repeat_until,
                indefinite=body.repeat_forever,
            )
        except RecurrenceError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    else:
        dates = [starts_at]

    # A one-off is its own series of one, so nothing downstream has to ask
    # whether a program is "really" a series.
    series_id = uuid.uuid4()
    label = describe_recurrence(body.frequency, starts_at) if starts_at else None
    # How long each occurrence runs, preserved across the whole series.
    span = (
        data["ends_at"] - starts_at
        if data.get("ends_at") and starts_at
        else None
    )

    created: list[Event] = []
    for index, when in enumerate(dates, start=1):
        row = Event(
            **{
                **data,
                "starts_at": when,
                "ends_at": when + span if span and when else data.get("ends_at"),
            },
            host_id=org_id,
            created_by_host_id=host.id,
            series_id=series_id,
            recurrence=label,
            series_index=index,
            series_total=len(dates),
        )
        # Gallery images belong to the occurrence people actually open.
        if index == 1:
            for img in body.gallery:
                row.images.append(EventImage(**img.model_dump()))
        db.add(row)
        created.append(row)

    db.commit()
    db.refresh(created[0])
    return created[0]


# Moved on the edited date only. Everything else about a repeating program is
# the program's, so it is written to every date still to come (see below).
_SCHEDULE_FIELDS = frozenset({"starts_at", "ends_at"})


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: uuid.UUID,
    body: EventUpdate,
    background: BackgroundTasks,
    host: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    """Edit a program.

    The console shows a repeating program as one card, so an edit to its
    title, place, price or anything else but the schedule is an edit to the
    program: it lands on this date and every later one still to come (not
    past dates — those are history — and not archived ones). The date and
    time move this date only.
    """
    event = db.get(Event, event_id)
    if not event or event.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if not _owns_or_admin(host, event):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your event")
    fields = body.model_dump(exclude_unset=True)
    shared = {f: v for f, v in fields.items() if f not in _SCHEDULE_FIELDS}
    # Queried before any row is touched (see the autoflush note below).
    later: list[Event] = []
    if shared and event.series_id:
        q = db.query(Event).filter(
            Event.series_id == event.series_id,
            Event.id != event.id,
            Event.deleted_at.is_(None),
            Event.starts_at >= func.now(),
        )
        if event.starts_at is not None:
            q = q.filter(Event.starts_at > event.starts_at)
        later = q.all()
    targets = [event, *later]
    # Compared after the commit: a moved time or place is mailed to everyone
    # who saved that date (member_mail.send_change_notice) — once per date,
    # since a member's save is one row per date.
    before = {
        t.id: {f: getattr(t, f) for f in member_mail.NOTICE_FIELDS} for t in targets
    }
    # And anything a connected Google Calendar shows is re-synced (core/gcal).
    shown_before = {
        t.id: {f: getattr(t, f) for f in _CALENDAR_FIELDS} for t in targets
    }
    # Checked against the event's own organization, not the caller's — a
    # superadmin editing another agency's program may only use that agency's
    # groups. Queried here, before the row is touched (see the note below).
    resolve_group_for_host(db, fields.get("access_group_id"), event.host_id)
    if fields.get("categories"):
        require_live_slugs(db, fields["categories"])
    for field, value in fields.items():
        # Every field on EventUpdate is Optional so it can be omitted, but an
        # explicit null is a different thing from an omission — exclude_unset
        # tracks presence, not value — and assigning it to a NOT NULL column
        # would 500 at commit. Reject it as the bad request it is.
        if value is None and field in _REQUIRED_FIELDS:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"{field} cannot be null"
            )
        setattr(event, field, value)
    for row in later:
        for field, value in shared.items():
            setattr(row, field, value)
    # Validate the merged rows, not the patch: switching only `requires_signup`
    # on an external program is what leaves it needing a link it doesn't have.
    # Nothing may touch the database between the loop above and this check —
    # a query here would autoflush the unvalidated row into the transaction.
    try:
        for row in targets:
            validate_registration(
                row.registration_mode, row.requires_signup, row.registration_url
            )
            validate_pricing(
                row.pricing_model,
                row.price_cents,
                row.price_group_size,
                row.price_sessions,
                row.price_note,
            )
            validate_numbers(row.capacity, row.min_age, row.max_age)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    db.commit()
    db.refresh(event)
    resync: list[uuid.UUID] = []
    for row in targets:
        changed = [
            f for f in member_mail.NOTICE_FIELDS if getattr(row, f) != before[row.id][f]
        ]
        if changed:
            # After the response: an SMTP round trip per member is not
            # something the organizer's save should wait on.
            background.add_task(member_mail.send_change_notice, row.id, changed)
        if any(getattr(row, f) != shown_before[row.id][f] for f in _CALENDAR_FIELDS):
            resync.append(row.id)
    if resync:
        background.add_task(gcal.sync_event_savers, resync)
    return event


def _series_targets(
    db: Session,
    event: Event,
    series: bool,
    include_archived: bool = False,
) -> list[Event]:
    """The rows an archive/restore should touch: one date, or the whole run.

    A one-off has no series_id, so `series=true` on it is simply the event
    itself — callers don't have to know which kind they're holding.
    """
    if not series or not event.series_id:
        return [event]
    q = db.query(Event).filter(Event.series_id == event.series_id)
    if not include_archived:
        q = q.filter(Event.deleted_at.is_(None))
    return q.all()


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: uuid.UUID,
    background: BackgroundTasks,
    series: bool = False,
    host: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    """Archive the program — the console's "Un-publish".

    The organization that posted it (any of its logins) may un-publish its own
    programs; a superadmin may un-publish anyone's. Saves no longer block the
    owner: an agency that cancels a program has to be able to take it down
    itself, and nothing here destroys anything members or funders rely on.

    `series=true` archives every remaining date of a repeating program, not just
    the one identified. The console lists a repeating program as one row, so
    "remove" there means the program — archiving only the date that happened to
    be on the card would leave fifteen others live and no sign of it.

    It leaves every member-facing surface immediately, but the row and its
    attendance history stay — those counts are what the organizer reports to
    funders, and a program members already attended is not something a later
    mistake should be able to erase.
    """
    event = db.get(Event, event_id)
    if not event or event.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    targets = _series_targets(db, event, series)

    # Across the whole run, not just the date on the card: a series that
    # somehow spans two organizations is not one either of them can retire.
    if not host.is_superadmin and any(
        e.host_id != org_id_of(host) for e in targets
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your event")
    for target in targets:
        target.deleted_at = func.now()
    db.commit()
    # Out of connected members' Google Calendars too.
    background.add_task(gcal.sync_event_savers, [t.id for t in targets])


@router.post("/{event_id}/restore", response_model=EventOut)
def restore_event(
    event_id: uuid.UUID,
    background: BackgroundTasks,
    series: bool = False,
    host: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    """Put an archived program back. This is what Undo calls.

    Same rule as archiving: the owning organization, or a superadmin. Nothing
    was destroyed, so this only has to clear the flag.

    Takes `series` for the same reason delete does — Undo has to put back
    exactly what was taken away, or the undo of removing a repeating program
    restores a single date and quietly loses the rest.
    """
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    targets = _series_targets(db, event, series, include_archived=True)
    if not host.is_superadmin and any(e.host_id != org_id_of(host) for e in targets):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your event")
    # Removing an organizer archives their programming with them. Restoring one
    # of those would put it back in the member feed under an account nobody can
    # sign into and that no longer appears in the console — half a removal.
    # Reachable only by a superadmin calling the API directly, since Undo is
    # offered on a program the same person just archived.
    if event.host is not None and event.host.deleted_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "That organizer's account was removed. Restore the account first.",
        )
    for target in targets:
        target.deleted_at = None
    db.commit()
    db.refresh(event)
    background.add_task(gcal.sync_event_savers, [t.id for t in targets])
    return event
