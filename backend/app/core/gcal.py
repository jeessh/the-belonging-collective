"""Connected Google Calendar: a member's saved list, kept in a calendar of its
own in their Google account.

A member connects once, over OAuth, with the narrow `calendar.app.created`
scope: the app may make its own calendars and manage the events on them, and
sees nothing else in the account. From then on `sync_member` makes that
calendar match `saved_events()` — inserting what was saved, updating what an
organizer changed, deleting what was un-saved or archived — so no save path
has to know what changed, only that something did. It runs after the
response, on every save and un-save (a caregiver's too: the row is the
member's), on an organizer's edit, archive or restore, and once a day from
the cron as a backstop for anything that changed some other way (a revoked
special-access approval, say).

Unconfigured — no GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — it is off, and the
calendar buttons fall back to the subscription feed (GET /calendar/{token}.ics).
"""

import base64
import hashlib
import logging
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlencode
from zoneinfo import ZoneInfo

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import BackgroundTasks
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.attendance import SAVED, Attendance
from app.models.event import Event
from app.models.user import User

log = logging.getLogger(__name__)

SCOPE = "https://www.googleapis.com/auth/calendar.app.created"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
API = "https://www.googleapis.com/calendar/v3"
CALENDAR_NAME = "The Belonging Collective"
TIME_ZONE = "America/Toronto"
# Marks the events this app put there. The calendar is the app's, but a member
# can still add their own events to it; those are never touched.
MARK = "tbcEventId"

# Tests swap in an httpx.MockTransport; None is the real network.
transport: httpx.BaseTransport | None = None


class GoogleError(Exception):
    """Google said no, or said something we don't understand."""


class Revoked(GoogleError):
    """The member took the app's access away in their Google account."""


class ScopeRefused(GoogleError):
    """They signed in but unticked the calendar permission."""


def available() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def redirect_uri() -> str:
    return (
        settings.GOOGLE_REDIRECT_URI
        or f"{settings.FRONTEND_ORIGIN}{settings.ROOT_PATH}/google-calendar/callback"
    )


def _client() -> httpx.Client:
    return httpx.Client(timeout=20, transport=transport)


# ---------- the refresh token, at rest ----------


def _fernet() -> Fernet:
    # Derived from JWT_SECRET so there is no second secret to manage; rotating
    # it means connected members connect again, which is the right outcome.
    digest = hashlib.sha256(b"google-refresh-token:" + settings.JWT_SECRET.encode())
    return Fernet(base64.urlsafe_b64encode(digest.digest()))


def _seal(refresh_token: str) -> str:
    return _fernet().encrypt(refresh_token.encode()).decode()


def _open(sealed: str) -> str:
    try:
        return _fernet().decrypt(sealed.encode()).decode()
    except InvalidToken as exc:
        raise Revoked("stored token no longer decrypts") from exc


# ---------- OAuth ----------


def auth_url(user: User) -> str:
    """Google's consent page. `state` names the member and expires in ten
    minutes; the callback also insists the same member is signed in."""
    state = jwt.encode(
        {
            "sub": str(user.id),
            "purpose": "google-calendar",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALG,
    )
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": SCOPE,
        # A refresh token, every time: sync runs when they aren't here.
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    if user.email:
        params["login_hint"] = user.email
    return f"{AUTH_URL}?{urlencode(params)}"


def read_state(state: str) -> uuid.UUID | None:
    try:
        claims = jwt.decode(state, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
    except JWTError:
        return None
    if claims.get("purpose") != "google-calendar":
        return None
    try:
        return uuid.UUID(claims["sub"])
    except (KeyError, ValueError):
        return None


def _token(client: httpx.Client, **form: str) -> dict:
    res = client.post(
        TOKEN_URL,
        data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            **form,
        },
    )
    try:
        error = res.json().get("error")
    except ValueError:
        error = None
    if res.status_code == 400 and error == "invalid_grant":
        raise Revoked("invalid_grant")
    if res.status_code != 200:
        raise GoogleError(f"token endpoint {res.status_code}: {res.text[:200]}")
    return res.json()


def _access_token(client: httpx.Client, user: User) -> str:
    return _token(
        client,
        grant_type="refresh_token",
        refresh_token=_open(user.google_refresh_token),
    )["access_token"]


def _auth(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


def _ensure_calendar(client: httpx.Client, access: str, calendar_id: str | None) -> str:
    """The app's calendar in their account: the one from last time if it is
    still there (a reconnect), else a new one."""
    if calendar_id:
        res = client.get(f"{API}/calendars/{quote(calendar_id, safe='')}", headers=_auth(access))
        if res.status_code == 200:
            return calendar_id
    res = client.post(
        f"{API}/calendars",
        headers=_auth(access),
        json={
            "summary": CALENDAR_NAME,
            "description": "Programs you saved on The Belonging Collective. "
            "Kept up to date for you — save or un-save a program there and it "
            "changes here.",
            "timeZone": TIME_ZONE,
        },
    )
    if res.status_code != 200:
        raise GoogleError(f"create calendar {res.status_code}: {res.text[:200]}")
    return res.json()["id"]


def finish_connect(db: Session, user: User, code: str) -> None:
    """Swap the callback's code for tokens, make (or find) the calendar, and
    store both. The first sync is the caller's to schedule."""
    with _client() as client:
        tokens = _token(
            client,
            grant_type="authorization_code",
            code=code,
            redirect_uri=redirect_uri(),
        )
        # Google's consent screen lets people untick a permission and carry on.
        if SCOPE not in tokens.get("scope", "").split():
            raise ScopeRefused(tokens.get("scope", ""))
        if not tokens.get("refresh_token"):
            raise GoogleError("no refresh token in the grant")
        calendar_id = _ensure_calendar(client, tokens["access_token"], user.google_calendar_id)
    user.google_refresh_token = _seal(tokens["refresh_token"])
    user.google_calendar_id = calendar_id
    user.google_connected_at = datetime.now(timezone.utc)
    db.commit()


def _forget(db: Session, user: User) -> None:
    user.google_refresh_token = None
    user.google_calendar_id = None
    user.google_connected_at = None
    db.commit()


def disconnect(db: Session, user: User) -> None:
    """Take the calendar out of their account and hand the access back.

    Best effort on Google's side — a token they already revoked can't delete
    anything — but ours is cleared regardless, so sync stops either way.
    """
    if user.google_refresh_token:
        try:
            with _client() as client:
                refresh = _open(user.google_refresh_token)
                access = _token(client, grant_type="refresh_token", refresh_token=refresh)[
                    "access_token"
                ]
                if user.google_calendar_id:
                    client.delete(
                        f"{API}/calendars/{quote(user.google_calendar_id, safe='')}",
                        headers=_auth(access),
                    )
                client.post(REVOKE_URL, data={"token": refresh})
        except (httpx.HTTPError, GoogleError):
            log.warning("Google disconnect for %s was partial", user.id, exc_info=True)
    _forget(db, user)


# ---------- sync ----------


def _gid(event: Event) -> str:
    # Google takes client ids of 5–1024 characters from base32hex (0-9, a-v);
    # "tbc" and a UUID's hex digits are all in it. Stable, so a program
    # re-saved after an un-save comes back as the same event.
    return f"tbc{event.id.hex}"


def _body(event: Event) -> dict:
    tz = ZoneInfo(TIME_ZONE)
    start = event.starts_at.astimezone(tz)
    end = (event.ends_at or event.starts_at + timedelta(hours=1)).astimezone(tz)
    page = f"{settings.FRONTEND_ORIGIN}/events/{event.id}"
    return {
        "summary": event.title,
        "location": event.location or ("Online" if event.is_virtual else ""),
        "description": "\n\n".join(filter(None, [event.description, page])),
        "start": {"dateTime": start.isoformat(), "timeZone": TIME_ZONE},
        "end": {"dateTime": end.isoformat(), "timeZone": TIME_ZONE},
        "source": {"title": CALENDAR_NAME, "url": page},
        "extendedProperties": {"private": {MARK: str(event.id)}},
    }


def _instant(value: dict | None) -> datetime | None:
    raw = (value or {}).get("dateTime")
    return datetime.fromisoformat(raw.replace("Z", "+00:00")) if raw else None


def _differs(have: dict, want: dict) -> bool:
    return (
        have.get("summary", "") != want["summary"]
        or have.get("location", "") != want["location"]
        or have.get("description", "") != want["description"]
        or _instant(have.get("start")) != _instant(want["start"])
        or _instant(have.get("end")) != _instant(want["end"])
    )


def _ok(res: httpx.Response, what: str, *allowed: int) -> None:
    if res.status_code not in (200, 204, *allowed):
        raise GoogleError(f"{what} {res.status_code}: {res.text[:200]}")


def sync_member(user_id: uuid.UUID) -> None:
    """Make the member's Google calendar match their saved list.

    Runs after the response, on a background task, so it opens its own
    session, and it never raises: a save must not fail because Google did.
    """
    # Imported here: routes/attendance imports this module to schedule syncs.
    from app.api.routes.attendance import saved_events

    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if not user or user.deleted_at is not None or user.google_calendar != "connected":
            return
        wanted = {_gid(e): _body(e) for e in saved_events(db, user) if e.starts_at}
        with _client() as client:
            access = _access_token(client, user)
            headers = _auth(access)
            calendar = user.google_calendar_id
            have: dict[str, dict] = {}
            page_token = None
            while True:
                params = {"maxResults": 2500}
                if page_token:
                    params["pageToken"] = page_token
                res = client.get(
                    f"{API}/calendars/{quote(calendar, safe='')}/events",
                    headers=headers,
                    params=params,
                )
                if res.status_code in (404, 410):
                    # They deleted the calendar in Google. Make a new one
                    # rather than stop syncing without a word.
                    calendar = _ensure_calendar(client, access, None)
                    user.google_calendar_id = calendar
                    db.commit()
                    have = {}
                    break
                _ok(res, "list events")
                for item in res.json().get("items", []):
                    if item.get("extendedProperties", {}).get("private", {}).get(MARK):
                        have[item["id"]] = item
                page_token = res.json().get("nextPageToken")
                if not page_token:
                    break

            events_url = f"{API}/calendars/{quote(calendar, safe='')}/events"
            for gid, body in wanted.items():
                current = have.get(gid)
                if current is None:
                    res = client.post(events_url, headers=headers, json={"id": gid, **body})
                    if res.status_code == 409:
                        # Deleted before (un-saved, then saved again): Google
                        # keeps the id on a cancelled event. Updating it with
                        # status confirmed brings it back.
                        res = client.put(
                            f"{events_url}/{gid}",
                            headers=headers,
                            json={**body, "status": "confirmed"},
                        )
                    _ok(res, "insert event")
                elif _differs(current, body):
                    res = client.put(
                        f"{events_url}/{gid}",
                        headers=headers,
                        json={**body, "status": "confirmed"},
                    )
                    _ok(res, "update event")
            for gid in have.keys() - wanted.keys():
                res = client.delete(f"{events_url}/{gid}", headers=headers)
                _ok(res, "delete event", 404, 410)
        log.info("Google Calendar synced for %s: %d program(s)", user_id, len(wanted))
    except Revoked:
        # Revoked in their Google account (or our key changed): stop trying,
        # and the buttons offer to connect again.
        log.info("Google Calendar access gone for %s; disconnecting", user_id)
        user = db.get(User, user_id)
        if user:
            _forget(db, user)
    except (httpx.HTTPError, GoogleError):
        log.exception("Google Calendar sync failed for %s", user_id)
    finally:
        db.close()


def after_save(background: BackgroundTasks, member: User) -> None:
    """Every save and un-save route calls this: a connected member's calendar
    follows after the response."""
    if member.google_calendar == "connected":
        background.add_task(sync_member, member.id)


def sync_event_savers(event_ids: list[uuid.UUID]) -> None:
    """After an organizer edits, archives or restores programs: re-sync every
    connected member who has one of them saved."""
    db = SessionLocal()
    try:
        members = [
            row[0]
            for row in db.query(Attendance.user_id)
            .join(User, User.id == Attendance.user_id)
            .filter(
                Attendance.event_id.in_(event_ids),
                Attendance.status == SAVED,
                User.google_calendar_id.isnot(None),
                User.deleted_at.is_(None),
            )
            .distinct()
            .all()
        ]
    finally:
        db.close()
    for member_id in members:
        sync_member(member_id)


def sync_everyone(db: Session) -> int:
    """The cron's backstop: every connected member, once."""
    ids = [
        row[0]
        for row in db.query(User.id)
        .filter(User.google_calendar_id.isnot(None), User.deleted_at.is_(None))
        .all()
    ]
    for member_id in ids:
        sync_member(member_id)
    return len(ids)
