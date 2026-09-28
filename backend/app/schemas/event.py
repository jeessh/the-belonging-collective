import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.pricing import PricingError
from app.core.pricing import validate as _validate_pricing
from app.models.event import EXTERNAL, INTERNAL


def validate_pricing(model, cents, group, sessions, note) -> None:
    """Same rule for create and for the merged result of a patch."""
    try:
        _validate_pricing(model or "free", cents, group, sessions, note)
    except PricingError as exc:
        raise ValueError(str(exc)) from exc

_MODES = {INTERNAL, EXTERNAL}


def validate_registration(
    mode: str, requires_signup: bool, url: str | None
) -> None:
    """The rules tying the two registration fields together.

    Shared by create (whole payload) and update (the merged result of a partial
    patch), so a PATCH can't leave a row in a state a POST would have rejected.
    """
    if mode not in _MODES:
        raise ValueError(f"registration_mode must be one of {sorted(_MODES)}")
    # The link is only load-bearing in one of the four states — the one where a
    # member is sent somewhere. Requiring it otherwise would just be a field to
    # fill in for staff who already have no time.
    if mode == EXTERNAL and requires_signup and not (url or "").strip():
        raise ValueError(
            "A registration link is required when sign-up happens on your own site."
        )
    if url and not url.startswith(("http://", "https://")):
        raise ValueError("The registration link must start with http:// or https://")


class AccessGroupRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class EventImageIn(BaseModel):
    url: str
    caption: str | None = None
    sort_order: int = 0


class EventImageOut(EventImageIn):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


# The standardized pitch every listing has. Anything longer belongs in `notes`.
DESCRIPTION_MAX = 1000
# Important links per program. Three is what the form offers.
LINKS_MAX = 3


class EventLink(BaseModel):
    """One important link — a flyer, a map, the agency's own page."""

    label: str = Field(min_length=1)
    url: str = Field(min_length=1)

    @model_validator(mode="after")
    def _normalize(self):
        self.label = self.label.strip()
        if not self.label:
            raise ValueError("Each link needs a label.")
        self.url = normalize_url(self.url) or ""
        if not self.url.startswith(("http://", "https://", "mailto:", "tel:")):
            raise ValueError("Each link needs a web address.")
        return self


class EventBase(BaseModel):
    title: str
    description: str = Field("", max_length=DESCRIPTION_MAX)
    notes: str | None = None
    # The topics it's about. `category` is the first of these and is written
    # from them, so callers set one field and every existing read path — the
    # interest match, the topic stepper, the console filters — still works.
    categories: list[str] = []
    category: str | None = None
    activity_type: str | None = None
    location: str | None = None
    capacity: int | None = None
    min_age: int | None = None
    max_age: int | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    accessibility_tags: list[str] = []
    pricing_model: str = "free"
    price_cents: int | None = None
    price_group_size: int | None = None
    price_sessions: int | None = None
    price_note: str | None = None
    is_free: bool = True
    is_virtual: bool = False
    is_youth: bool = False
    requires_signup: bool = False
    registration_mode: str = INTERNAL
    registration_url: str | None = None
    # Shown alongside the program. Not read by the registration states —
    # registration_url is the only link those use.
    links: list[EventLink] = Field([], max_length=LINKS_MAX)
    cover_image_url: str | None = None
    # The agency's flyer — PDF or image — from POST /events/posters.
    poster_url: str | None = None
    # Null = public. Set = special access: only members approved into the
    # group find it in lists. The group must belong to the event's own host.
    access_group_id: uuid.UUID | None = None


def normalize_url(url: str | None) -> str | None:
    """"google.com" is a URL. Someone typing it has not made a mistake.

    A missing scheme was rejected outright by the browser's own url input and
    then again here, which meant an agency pasting the address bar contents got
    an error message about a format they had no reason to know. Anything that
    already carries a scheme is left exactly as typed.
    """
    if url is None:
        return None
    value = url.strip()
    if not value:
        return None
    if "://" in value.split("?", 1)[0]:
        return value
    # mailto: and tel: are schemes too, and neither takes "//".
    if value.split(":", 1)[0].lower() in {"mailto", "tel"} and ":" in value:
        return value
    return f"https://{value}"


def _sync_category(model) -> None:
    """Keep `category` as the first of `categories`, whichever the caller sent.

    One field is the truth and the other is a view of it; letting them drift
    would mean an event that groups under one topic and matches on another.
    """
    if model.categories:
        model.category = model.categories[0]
    elif model.category:
        model.categories = [model.category]


class EventCreate(EventBase):
    gallery: list[EventImageIn] = []
    # once | weekly | biweekly | monthly | annual. Anything but "once" creates
    # a dated row per occurrence, all sharing one series_id.
    frequency: str = "once"
    occurrence_count: int | None = None
    repeat_until: datetime | None = None
    # "It just keeps going" — said out loud, rather than inferred from a form
    # with the count left blank, which is far more often a mistake.
    repeat_forever: bool = False

    @model_validator(mode="after")
    def _check_registration(self):
        self.registration_url = normalize_url(self.registration_url)
        _sync_category(self)
        validate_registration(
            self.registration_mode, self.requires_signup, self.registration_url
        )
        validate_pricing(
            self.pricing_model,
            self.price_cents,
            self.price_group_size,
            self.price_sessions,
            self.price_note,
        )
        return self


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = Field(None, max_length=DESCRIPTION_MAX)
    notes: str | None = None
    categories: list[str] | None = None
    category: str | None = None
    activity_type: str | None = None
    location: str | None = None
    capacity: int | None = None
    min_age: int | None = None
    max_age: int | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    accessibility_tags: list[str] | None = None
    pricing_model: str | None = None
    price_cents: int | None = None
    price_group_size: int | None = None
    price_sessions: int | None = None
    price_note: str | None = None
    is_free: bool | None = None
    is_virtual: bool | None = None
    is_youth: bool | None = None
    requires_signup: bool | None = None
    registration_mode: str | None = None
    registration_url: str | None = None
    links: list[EventLink] | None = Field(None, max_length=LINKS_MAX)
    cover_image_url: str | None = None
    poster_url: str | None = None
    access_group_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _normalize(self):
        if self.registration_url is not None:
            self.registration_url = normalize_url(self.registration_url)
        # Only when the caller actually sent topics; a PATCH that omits them
        # must not blank the category off the back of an empty default.
        if self.categories is not None:
            self.category = self.categories[0] if self.categories else None
        return self


class EventOut(EventBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    host_id: uuid.UUID
    host_name: str = ""
    # The group a restricted program belongs to, so the page can name what the
    # member is asking to join. Null for a public program.
    access_group: AccessGroupRef | None = None
    # requested | approved | declined | revoked | none — this member's standing
    # with that group. Only set for a signed-in member on a restricted program;
    # null otherwise. Filled by the route, not read off the row.
    access_status: str | None = None
    host_logo_url: str | None = None
    event_no: int = 0
    series_id: uuid.UUID | None = None
    recurrence: str | None = None
    series_index: int | None = None
    series_total: int | None = None
    # Built from the structured fields so every surface says it the same way.
    price_label: str = ""
    # "N going". Null for signed-out viewers — the public routes blank it.
    saved_count: int | None = 0
    images: list[EventImageOut] = []
    created_at: datetime
