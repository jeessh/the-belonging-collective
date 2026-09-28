"""iCalendar export, hand-rolled.

RFC 5545 is small enough for what we emit — one VEVENT per dated program —
that a library would be a dependency for the sake of six lines of escaping.
"""

from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.models.event import Event

PRODID = "-//The Belonging Collective//EN"


def _escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def _fold(line: str) -> str:
    """Wrap at 75 octets, never inside a UTF-8 sequence. Continuation lines
    start with a space, which counts toward their 75."""
    out: list[bytes] = []
    current = b""
    for char in line:
        chunk = char.encode("utf-8")
        limit = 75 if not out else 74
        if len(current) + len(chunk) > limit:
            out.append(current)
            current = b""
        current += chunk
    out.append(current)
    return b"\r\n ".join(out).decode("utf-8")


def _stamp(when: datetime) -> str:
    return when.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _vevent(event: Event, now: datetime) -> list[str]:
    starts = event.starts_at
    ends = event.ends_at or starts + timedelta(hours=1)
    lines = [
        "BEGIN:VEVENT",
        f"UID:{event.id}@the-belonging-collective",
        f"DTSTAMP:{_stamp(now)}",
        f"DTSTART:{_stamp(starts)}",
        f"DTEND:{_stamp(ends)}",
        f"SUMMARY:{_escape(event.title)}",
    ]
    if event.location:
        lines.append(f"LOCATION:{_escape(event.location)}")
    if event.description:
        lines.append(f"DESCRIPTION:{_escape(event.description)}")
    lines.append(f"URL:{settings.FRONTEND_ORIGIN}/events/{event.id}")
    lines.append("END:VEVENT")
    return lines


def build(events: list[Event], name: str | None = None) -> str:
    """A VCALENDAR of every dated event given; undated ones are skipped.

    `name` is for a subscribed feed: the calendar's title in the member's
    app, plus a hint to re-fetch every few hours (Google ignores it and
    refreshes on its own schedule; Apple and Outlook honour it).
    """
    now = datetime.now(timezone.utc)
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]
    if name:
        lines += [
            f"X-WR-CALNAME:{_escape(name)}",
            "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
            "X-PUBLISHED-TTL:PT6H",
        ]
    for event in events:
        if event.starts_at:
            lines.extend(_vevent(event, now))
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"
