"""Importing an organization's existing calendar as events.

Reads any iCal (.ics) calendar — a Teamup feed like KW Hab's community
calendar, a Google Calendar or Outlook export — and turns each calendar event
into a *program*: one or more dated occurrences, the way the console's own
repeating events are stored (one row per date, sharing a series_id). The
calendar's own dates are used, not our weekly / monthly rules, so skipped
dates (EXDATE), moved ones (RECURRENCE-ID) and "last Wednesday of the month"
all come through as they are.

`parse` is pure (bytes in, programs out) so it can be checked without a
database; `match_*` and `find_duplicates` look at the platform's own
organizations, topics and events; the routes in `api/routes/imports.py` put
the two together into a preview a superadmin reviews, then a commit.

Only upcoming dates are imported, at most `MAX_DATES` per program and
`HORIZON_DAYS` ahead — a weekly event with no end would otherwise be
infinite.
"""

from __future__ import annotations

import difflib
import html
import ipaddress
import re
import socket
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import httpx
import icalendar
from dateutil.rrule import rrulestr

LOCAL = ZoneInfo("America/Toronto")
MAX_BYTES = 5_000_000
HORIZON_DAYS = 730
MAX_DATES = 104
LINKS_MAX = 3

# Teamup lets a calendar tag events with more than an organization; these
# tags say something about the event itself rather than who runs it.
FREE_TAGS = {"free community events", "free events", "free"}
PAID_TAGS = {"paid community events", "paid events", "paid"}
VIRTUAL_TAGS = {"virtual events", "virtual", "online"}


class ImportProblem(ValueError):
    """The calendar couldn't be fetched or read; the message says why."""


@dataclass
class Program:
    key: str
    title: str
    description: str
    location: str | None
    who: str | None
    org_label: str | None
    links: list[dict] = field(default_factory=list)
    is_free: bool | None = None
    is_virtual: bool = False
    min_age: int | None = None
    dates: list[tuple[datetime, datetime | None]] = field(default_factory=list)
    recurrence: str | None = None


# ---------------------------------------------------------------- fetching


def fetch(url: str) -> bytes:
    """The calendar at `url`. http(s) only, a public address only (this runs
    on the server, so it mustn't be pointed at the server's own network), and
    at most MAX_BYTES."""
    url = url.strip()
    if url.startswith("webcal://"):
        url = "https://" + url[len("webcal://") :]
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ImportProblem("Use the calendar's web address (https://…).")
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror as exc:
        raise ImportProblem("Couldn't find that address.") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise ImportProblem("That address isn't a public calendar.")
    try:
        with httpx.stream("GET", url, timeout=20, follow_redirects=True) as res:
            if res.status_code != 200:
                raise ImportProblem(
                    f"The calendar didn't load (the site answered {res.status_code})."
                )
            body = b""
            for chunk in res.iter_bytes():
                body += chunk
                if len(body) > MAX_BYTES:
                    raise ImportProblem("That calendar is too large to import (over 5 MB).")
            return body
    except httpx.HTTPError as exc:
        raise ImportProblem("Couldn't reach that calendar. Check the address.") from exc


# ----------------------------------------------------------------- parsing


def _aware(value) -> tuple[datetime, bool]:
    """A calendar time as an aware datetime, and whether it was all-day."""
    if isinstance(value, datetime):
        return (value if value.tzinfo else value.replace(tzinfo=LOCAL)), False
    if isinstance(value, date):
        return datetime.combine(value, time(0, 0), tzinfo=LOCAL), True
    raise ImportProblem("An event has a start this importer can't read.")


def _text(value) -> str:
    if value is None:
        return ""
    return html.unescape(str(value)).replace("\xa0", " ").strip()


def _categories(component) -> list[str]:
    raw = component.get("CATEGORIES")
    if raw is None:
        return []
    items = raw if isinstance(raw, list) else [raw]
    out: list[str] = []
    for item in items:
        cats = getattr(item, "cats", None)
        values = cats if cats is not None else str(item).split(",")
        for v in values:
            # Some calendars put several in one value, comma-separated.
            out.extend(p.strip() for p in str(v).split(",") if p.strip())
    return out


_LINK_LINE = re.compile(r"^(?P<label>[^\n]*?):\s*(?P<url>(?:https?|mailto):\S+)\s*$")
_IMAGE = re.compile(r"\.(png|jpe?g|gif|webp)(\?|$)", re.I)


def _clean_description(text: str) -> tuple[str, list[dict]]:
    """The description without the "Who:" line (kept separately) or image
    attachments, and its link lines lifted out as links."""
    lines_out: list[str] = []
    links: list[dict] = []
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.lower().startswith("who:"):
            continue
        m = _LINK_LINE.match(stripped)
        if stripped.startswith("!") and m:
            continue  # an attached picture
        if m:
            url = m.group("url")
            if _IMAGE.search(url) or "teamup.com" in url:
                continue
            label = m.group("label").strip().replace("_", " ") or "Link"
            if url.startswith("http") and len(links) < LINKS_MAX:
                links.append({"label": label[:80], "url": url})
                continue
            lines_out.append(f"{label}: {url.removeprefix('mailto:')}")
            continue
        lines_out.append(stripped)
    body = re.sub(r"\n{3,}", "\n\n", "\n".join(lines_out)).strip()
    return body, links


_DAYS = {"MO": "Monday", "TU": "Tuesday", "WE": "Wednesday", "TH": "Thursday",
         "FR": "Friday", "SA": "Saturday", "SU": "Sunday"}
_ORD = {"1": "first", "2": "second", "3": "third", "4": "fourth", "-1": "last"}


def _describe(rule: dict, first: datetime) -> str | None:
    """'Weekly on Mondays', 'Every 2 weeks on Tuesdays', 'Monthly on the last
    Wednesday' — how the console's own repeating events read."""
    freq = (rule.get("FREQ") or [""])[0]
    interval = int((rule.get("INTERVAL") or [1])[0])
    byday = [str(d) for d in rule.get("BYDAY") or []]
    local = first.astimezone(LOCAL)
    if freq == "WEEKLY":
        names = [_DAYS.get(d[-2:], d) + "s" for d in byday] or [local.strftime("%A") + "s"]
        lead = "Weekly" if interval == 1 else f"Every {interval} weeks"
        return f"{lead} on {' and '.join(names)}"
    if freq == "MONTHLY":
        if byday:
            d = byday[0]
            n, day = d[:-2] or "1", d[-2:]
            return f"Monthly on the {_ORD.get(n, n)} {_DAYS.get(day, day)}"
        return f"Monthly on the {local.day}{_suffix(local.day)}"
    if freq == "DAILY":
        return "Daily" if interval == 1 else f"Every {interval} days"
    if freq == "YEARLY":
        return "Yearly"
    return None


def _suffix(n: int) -> str:
    return "th" if 11 <= n % 100 <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")


def _strip_audience(title: str, who: str | None) -> str:
    """'Meal Planning (People who registered through LEG Up!)' → 'Meal
    Planning' when the bracket is the audience, which is kept as `who`."""
    m = re.match(r"^(.*?)\s*\(([^()]*)\)\s*$", title)
    if m and who and m.group(2).strip().lower() == who.strip().lower():
        return m.group(1).strip()
    return title


def parse(data: bytes, now: datetime | None = None) -> list[Program]:
    """Every calendar event with a date still to come, as a program."""
    now = now or datetime.now(timezone.utc)
    horizon = now + timedelta(days=HORIZON_DAYS)
    try:
        cal = icalendar.Calendar.from_ical(data)
    except ValueError as exc:
        raise ImportProblem("That isn't a calendar file this importer can read.") from exc

    masters = []
    moved: dict[str, dict[datetime, object]] = {}
    for comp in cal.walk("VEVENT"):
        uid = str(comp.get("UID") or "")
        if comp.get("RECURRENCE-ID") is not None:
            rid, _ = _aware(comp.decoded("RECURRENCE-ID"))
            moved.setdefault(uid, {})[rid.astimezone(timezone.utc)] = comp
        else:
            masters.append(comp)

    programs: list[Program] = []
    for comp in masters:
        if str(comp.get("STATUS") or "").upper() == "CANCELLED":
            continue
        uid = str(comp.get("UID") or f"event-{len(programs)}")
        start, all_day = _aware(comp.decoded("DTSTART"))
        if comp.get("DTEND") is not None:
            end, _ = _aware(comp.decoded("DTEND"))
        elif comp.get("DURATION") is not None:
            end = start + comp.decoded("DURATION")
        else:
            end = None
        span = (end - start) if end and not all_day else None

        rrule = comp.get("RRULE")
        if rrule is not None:
            rule = rrulestr(rrule.to_ical().decode(), dtstart=start)
            starts = rule.between(now, horizon, inc=True)
            skipped = set()
            exdates = comp.get("EXDATE")
            for ex in exdates if isinstance(exdates, list) else ([exdates] if exdates else []):
                for d in getattr(ex, "dts", []):
                    when, _ = _aware(d.dt)
                    skipped.add(when.astimezone(timezone.utc))
            starts = [s for s in starts if s.astimezone(timezone.utc) not in skipped]
            recurrence = _describe(dict(rrule), start)
        else:
            starts = [start] if start >= now - timedelta(hours=1) else []
            recurrence = None

        overrides = moved.get(uid, {})
        dates: list[tuple[datetime, datetime | None]] = []
        for s in starts:
            o = overrides.get(s.astimezone(timezone.utc))
            if o is not None:
                if str(o.get("STATUS") or "").upper() == "CANCELLED":
                    continue
                os_, _ = _aware(o.decoded("DTSTART"))
                oe = _aware(o.decoded("DTEND"))[0] if o.get("DTEND") is not None else None
                dates.append((os_, oe))
            else:
                dates.append((s, s + span if span else None))
        dates = dates[:MAX_DATES]
        if not dates:
            continue

        who = _text(comp.get("X-TEAMUP-WHO")) or None
        description, links = _clean_description(_text(comp.get("DESCRIPTION")))
        if not who:
            m = re.search(r"^who:\s*(.+)$", _text(comp.get("DESCRIPTION")), re.I | re.M)
            who = m.group(1).strip() if m else None
        tags = _categories(comp)
        lowered = {t.lower() for t in tags}
        orgs = [t for t in tags if t.lower() not in FREE_TAGS | PAID_TAGS | VIRTUAL_TAGS]
        location = _text(comp.get("LOCATION")) or _text(comp.get("X-TEAMUP-WHERE")) or None
        age = re.search(r"(\d{1,2})\s*\+", who or "")
        programs.append(
            Program(
                key=uid,
                title=_strip_audience(_text(comp.get("SUMMARY")) or "Untitled event", who),
                description=description,
                location=location,
                who=who,
                org_label=orgs[0] if orgs else None,
                links=links,
                is_free=True if lowered & FREE_TAGS else False if lowered & PAID_TAGS else None,
                is_virtual=bool(lowered & VIRTUAL_TAGS)
                or bool(location and re.search(r"\b(zoom|online|virtual|teams)\b", location, re.I)),
                min_age=int(age.group(1)) if age else None,
                dates=dates,
                recurrence=recurrence if len(dates) > 1 else None,
            )
        )
    programs.sort(key=lambda p: p.dates[0][0])
    return programs


# --------------------------------------------------------------- matching


def _norm(name: str) -> str:
    name = name.lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", name).strip()


def _initials(name: str) -> str:
    return "".join(w[0] for w in _norm(name).split() if w not in {"of", "and", "the"})


def match_org(label: str | None, orgs: list[tuple[str, str]]) -> str | None:
    """The id of the platform organization a calendar's organization name
    means, or None. `orgs` is [(id, name)]. Exact names first, then one name
    inside the other ("DSO - Developmental Services Ontario" ⊃ "Developmental
    Services Ontario"), then initials ("WRFN" = "Waterloo Region Family
    Network")."""
    if not label:
        return None
    want = _norm(label)
    for oid, name in orgs:
        if _norm(name) == want:
            return oid
    for oid, name in orgs:
        n = _norm(name)
        if len(n) > 3 and (n in want or want in n):
            return oid
    # One side written as initials: "WRFN" here, "Waterloo Region Family
    # Network" in the calendar (or the other way round).
    label_compact, label_initials = want.replace(" ", ""), _initials(label)
    for oid, name in orgs:
        compact, initials = _norm(name).replace(" ", ""), _initials(name)
        if (len(compact) >= 3 and compact == label_initials) or (
            len(label_compact) >= 3 and label_compact == initials
        ):
            return oid
    return None


# Words that suggest a topic, by topic slug. A guess for the preview — the
# superadmin confirms or changes it before anything is created.
_TOPIC_WORDS: dict[str, tuple[str, ...]] = {
    "cooking": ("bak", "cook", "meal", "kitchen", "recipe", "food", "cupcake", "cake", "lunch",
                "dinner", "brunch", "snack", "smoothie", "pizza", "cookie"),
    "arts-crafts": ("art", "craft", "paint", "draw", "studio", "sew", "knit", "pottery", "collage",
                    "bead", "colour", "color"),
    "music": ("music", "sing", "karaoke", "choir", "drum", "concert", "band"),
    "fitness": ("yoga", "fitness", "exercise", "walk", "gym", "zumba", "dance", "stretch", "workout"),
    "sports": ("sport", "soccer", "basketball", "bowling", "golf", "swim", "hockey", "baseball",
               "pickleball", "curling", "skating"),
    "games": ("game", "bingo", "trivia", "cards", "puzzle", "lego"),
    "social": ("social", "party", "hangout", "coffee", "celebrat", "picnic", "bbq", "festival",
               "meet up", "meetup", "dance party", "holiday", "christmas", "halloween"),
    "education": ("learn", "class", "workshop", "training", "skills", "course", "info session",
                  "information session", "seminar", "budget", "money", "planning", "conference",
                  "tradeshow", "computer", "literacy"),
    "wellness": ("wellness", "mindful", "mental health", "self-care", "self care", "meditat",
                 "health", "relax", "garden"),
    "support-group": ("support group", "peer support", "caregiver", "parents", "families", "family"),
    "fundraising": ("fundrais", "gala", "donat", "auction", "raffle"),
    "youth-programs": ("youth", "teen", "kids", "children", "camp"),
    "recreation": ("outing", "trip", "recreation", "park", "nature", "hike", "movie", "museum",
                   "library", "tour"),
}


def guess_topics(text: str, live: set[str]) -> list[str]:
    """Up to two topics whose words appear in `text`, best first, among the
    platform's live topics."""
    t = text.lower()
    scores = []
    for slug, words in _TOPIC_WORDS.items():
        if slug not in live:
            continue
        hits = sum(1 for w in words if w in t)
        if hits:
            scores.append((hits, slug))
    scores.sort(reverse=True)
    return [slug for _, slug in scores[:2]]


def similar(a: str, b: str) -> bool:
    a, b = _norm(a), _norm(b)
    return a == b or difflib.SequenceMatcher(None, a, b).ratio() >= 0.85


def same_day(a: datetime, b: datetime) -> bool:
    return a.astimezone(LOCAL).date() == b.astimezone(LOCAL).date()
