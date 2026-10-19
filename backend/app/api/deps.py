import uuid

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.security import credential_fingerprint, decode_token
from app.db.session import SessionLocal
from app.models.host import Host
from app.models.user import User


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Members and organizers each have their own session cookie. They used to
# share one, so signing in on one side quietly signed you out of the other in
# the same browser — a member signing up while an organizer was signed in
# (or the reverse) was then told to sign in again on the next request.
# The member cookie keeps the old name; the organizer one is derived from it,
# so there is no new setting.
def cookie_name(role: str) -> str:
    return f"{settings.COOKIE_NAME}_host" if role == "host" else settings.COOKIE_NAME


def set_auth_cookie(response: Response, token: str) -> None:
    """Store a session in the cookie for the role the token was issued to."""
    role = (decode_token(token) or {}).get("role", "user")
    response.set_cookie(
        key=cookie_name(role),
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def clear_auth_cookie(response: Response, request: Request, role: str) -> None:
    """Sign one side out, leaving the other's session alone."""
    response.delete_cookie(key=cookie_name(role), path="/")
    # An organizer session from before the split lives in the shared cookie;
    # clear that too, but only if it is theirs.
    if role == "host":
        legacy = request.cookies.get(settings.COOKIE_NAME)
        if legacy and (decode_token(legacy) or {}).get("role") == "host":
            response.delete_cookie(key=settings.COOKIE_NAME, path="/")


def _payload(request: Request, role: str) -> dict | None:
    """The live token for `role`, from its own cookie — or, for organizers
    signed in before the split, from the shared one, so the deploy that
    split them didn't sign anybody out."""
    for name in dict.fromkeys((cookie_name(role), settings.COOKIE_NAME)):
        token = request.cookies.get(name)
        payload = decode_token(token) if token else None
        if payload and payload.get("role") == role:
            return payload
    return None


def payload_cv(payload: dict) -> str | None:
    """The credential fingerprint a token was issued with, if it has one."""
    return payload.get("cv")


def _key_still_current(payload: dict, user: User) -> bool:
    """Whether this token was issued against the member's current password.

    Member sessions carry `cv`, a fingerprint of the credential in force when
    they signed in (see security.credential_fingerprint). A reset changes the
    hash, so tokens opened with the old password stop working here rather
    than a week later when they expire.

    A token with no `cv` predates this check and is refused: the alternative is
    honouring exactly the sessions a reset is supposed to close.
    """
    return payload.get("cv") == credential_fingerprint(user.password_hash)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    p = _payload(request, "user")
    if not p:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in as a member")
    user = db.get(User, uuid.UUID(p["sub"]))
    # Tokens last a week, so an archived member could otherwise keep using the
    # app until theirs expired.
    if not user or user.deleted_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found")
    if not _key_still_current(p, user):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in again")
    return user


def get_optional_user(
    request: Request, db: Session = Depends(get_db)
) -> User | None:
    """The signed-in member, or None. For endpoints on public pages, where a
    signed-out visitor is a normal caller rather than an error."""
    p = _payload(request, "user")
    if not p:
        return None
    user = db.get(User, uuid.UUID(p["sub"]))
    if not user or user.deleted_at is not None:
        return None
    # A stale session is a signed-out visitor here, not an error — the public
    # pages this backs work perfectly well without an account.
    return user if _key_still_current(p, user) else None


def load_live_host(db: Session, host_id: uuid.UUID) -> Host | None:
    """A live organizer login with its organization loaded.

    A staff login's access level is its organization's, so the org comes
    along in the same query — and a staff login whose organization has been
    archived is treated as archived itself, whatever its own row says.
    """
    host = (
        db.query(Host)
        .options(joinedload(Host.org))
        .filter(Host.id == host_id, Host.deleted_at.is_(None))
        .first()
    )
    if host is None:
        return None
    if host.org_id is not None and (host.org is None or host.org.deleted_at is not None):
        return None
    return host


def get_optional_host(
    request: Request, db: Session = Depends(get_db)
) -> Host | None:
    """The signed-in organizer, or None — get_optional_user for hosts."""
    p = _payload(request, "host")
    if not p:
        return None
    host = load_live_host(db, uuid.UUID(p["sub"]))
    if not host:
        return None
    return (
        host
        if payload_cv(p) == credential_fingerprint(host.password_hash)
        else None
    )


def get_current_host(request: Request, db: Session = Depends(get_db)) -> Host:
    p = _payload(request, "host")
    if not p:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in as a host")
    # Same reason as get_current_user: tokens last a week, so an archived
    # organizer would otherwise keep publishing until theirs expired.
    host = load_live_host(db, uuid.UUID(p["sub"]))
    if not host:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found")
    # As for members: the token carries a fingerprint of the password it was
    # issued against, so resetting a password ends the sessions opened with the
    # old one instead of leaving them live for the week a token lasts.
    if payload_cv(p) != credential_fingerprint(host.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in again")
    return host


def require_admin(host: Host = Depends(get_current_host)) -> Host:
    """Superadmins only. Read from the row (through the organization, for a
    staff login), never from the token's `is_admin` claim."""
    if not host.is_superadmin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return host
