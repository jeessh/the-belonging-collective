import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    Response,
    status,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import (
    clear_auth_cookie,
    get_db,
    load_live_host,
    set_auth_cookie,
)
from app.core.icons import random_icon_set
from app.core.rate_limit import (
    IDENTITY_LIMIT,
    IP_LIMIT,
    clear as clear_rate_limit,
    client_key,
    enforce as enforce_rate_limit,
    record,
)
from app.core.security import (
    create_access_token,
    credential_fingerprint,
    hash_password,
    verify_password,
)
from app.core.categories import require_live_slugs
from app.core.config import settings
from app.core.security import decode_token
from app.core.mail import send as send_mail
from app.db.session import SessionLocal
from app.models.host import Host, org_id_of
from app.models.password_reset import HostPasswordReset, MemberPasswordReset
from app.models.user import User
from app.schemas.auth import (
    HostForgot,
    HostLogin,
    HostReset,
    UserForgot,
    UserLogin,
    UserReset,
    UserSignup,
)
from app.schemas.user import CarePerson

router = APIRouter(prefix="/auth", tags=["auth"])


def _sign_in_member(response: Response, user: User) -> None:
    """Open a member session, bound to the credential it was opened with.

    The token carries a fingerprint of the password hash in force right now,
    and every request re-checks it — so a reset ends the sessions the old
    password opened, rather than leaving them live for the week a token lasts.
    """
    set_auth_cookie(
        response,
        create_access_token(
            user.id, "user", cred_hash=credential_fingerprint(user.password_hash)
        ),
    )


def _make_username(first: str, last: str) -> str:
    return f"{first.strip().lower()}_{last.strip().lower()}".replace(" ", "")


def _allocate_unique_icons(db: Session, username: str) -> list[str]:
    """A hidden icon set free for this name — uq_users_username_icons still
    needs one per row. Scoped to the username so the 132 pairs never run out
    across the whole membership."""
    for _ in range(50):
        icons = random_icon_set()
        taken = (
            db.query(User)
            .filter(User.username == username, User.icons == icons)
            .first()
        )
        if not taken:
            return icons
    raise HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Could not allocate a unique icon set — expand the icon pool.",
    )


def _live_member_by_email(db: Session, email: str) -> User | None:
    return (
        db.query(User)
        .filter(User.email == email, User.deleted_at.is_(None))
        .first()
    )


def new_member(
    db: Session,
    first_name: str,
    last_name: str,
    *,
    email: str,
    password: str,
    accessibility_prefs: list[str] | None = None,
    interest_categories: list[str] | None = None,
    is_caregiver: bool = False,
) -> User:
    """Create and commit a member account. Every place that makes a member —
    self sign-up, the console, a caregiver — comes through here."""
    username = _make_username(first_name, last_name)
    user = User(
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        username=username,
        email=email.strip().lower(),
        password_hash=hash_password(password),
        auth_type="password",
        icons=_allocate_unique_icons(db, username),
        accessibility_prefs=accessibility_prefs or [],
        interest_categories=interest_categories or [],
        is_caregiver=is_caregiver,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        # Callers pre-check the email, but check-then-insert can lose a race
        # to a concurrent signup with the same address.
        db.rollback()
        constraint = getattr(exc.orig.diag, "constraint_name", None)
        if constraint == "uq_users_email_live":
            raise HTTPException(
                status.HTTP_409_CONFLICT, "That email already has an account."
            )
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Could not create the account — try again."
        )
    db.refresh(user)
    return user


def credential_identity(email: str) -> str:
    """The rate-limit key a credential counts against — the same one the
    sign-in door uses for it, so guessing here costs what guessing there does."""
    return f"user:{email.strip().lower()}"


def member_by_credential(db: Session, email: str, password: str) -> User | None:
    """The live member this email and password opens, or None."""
    user = _live_member_by_email(db, email.strip().lower())
    if (
        user
        and user.auth_type == "password"
        and verify_password(password, user.password_hash)
    ):
        return user
    return None


# ---------- Community members (email + password) ----------


@router.post("/signup/user", status_code=status.HTTP_201_CREATED)
def signup_user(
    body: UserSignup,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    username = _make_username(body.first_name, body.last_name)
    email = body.email.strip().lower()
    require_live_slugs(db, body.interest_categories)
    # Same budget as login, keyed on the same thing: the 409 below says
    # whether an address has an account, so a sweep here has to cost what a
    # sweep of the login route costs.
    ip_key = client_key(request)
    id_key = f"user:{email}"
    enforce_rate_limit(db, {id_key: IDENTITY_LIMIT, ip_key: IP_LIMIT})
    if _live_member_by_email(db, email):
        record(db, id_key, ip_key)
        raise HTTPException(
            status.HTTP_409_CONFLICT, "That email already has an account."
        )

    user = new_member(
        db,
        body.first_name,
        body.last_name,
        email=email,
        password=body.password,
        accessibility_prefs=body.accessibility_prefs,
        interest_categories=body.interest_categories,
        is_caregiver=body.is_caregiver,
    )

    _sign_in_member(response, user)
    # Prefs are intentionally omitted here — the wizard re-reads GET /users/me.
    return {
        "id": str(user.id),
        "email": user.email,
        "is_caregiver": user.is_caregiver,
    }


@router.post("/login/user")
def login_user(
    body: UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    email = body.email.strip().lower()
    ip_key = client_key(request)
    id_key = f"user:{email}"
    enforce_rate_limit(db, {id_key: IDENTITY_LIMIT, ip_key: IP_LIMIT})

    user = member_by_credential(db, email, body.password)
    if not user:
        record(db, id_key, ip_key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    clear_rate_limit(db, id_key)
    _sign_in_member(response, user)
    return {"id": str(user.id), "email": user.email, "role": "user"}


# ---------- Hosts / admins (email + password) ----------


# There is deliberately no host signup route. Organizer accounts are created by
# a superadmin via POST /hosts — self-serve registration would have let anyone
# on the internet publish programs to the member feed.


@router.post("/login/host")
def login_host(
    body: HostLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    email = body.email.strip().lower()
    ip_key = client_key(request)
    id_key = f"host:{email}"
    enforce_rate_limit(db, {id_key: IDENTITY_LIMIT, ip_key: IP_LIMIT})

    host = (
        db.query(Host)
        .filter(Host.email == email, Host.deleted_at.is_(None))
        .first()
    )
    if not host or not verify_password(body.password, host.password_hash):
        record(db, id_key, ip_key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    # A staff login is only as live as its organization: load_live_host applies
    # that rule, so a login whose agency was removed can't get back in here.
    if load_live_host(db, host.id) is None:
        record(db, id_key, ip_key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    clear_rate_limit(db, id_key)
    set_auth_cookie(
        response, create_access_token(
            host.id,
            "host",
            is_admin=host.is_superadmin,
            cred_hash=credential_fingerprint(host.password_hash),
        )
    )
    return {"id": str(host.id), "email": host.email, "is_admin": host.is_superadmin}


# ---------- Organizer password reset ----------
#
# The only way back into a locked-out organizer account used to be a superadmin
# setting a new password by hand — which left the sole superadmin, the one
# account guaranteed to exist, with no route back in at all.

RESET_TTL_MINUTES = 60
# Per address, per window. Low: this sends mail to somebody who did not
# necessarily ask for it, and five is already more than a real person needs.
FORGOT_LIMIT = 5
# Per address, across all addresses. Deliberately NOT the shared IP_LIMIT of
# 200 — that number is sized to tolerate a room full of members mistyping
# passwords, and reused here it would authorise 200 emails per address per window.
FORGOT_IP_LIMIT = 20


def _reset_hash(token: str) -> str:
    """SHA-256, as for invitations: 32 bytes of entropy has nothing to guess,
    so the slow hashing a password needs buys nothing here."""
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/host/forgot")
def forgot_host_password(
    body: HostForgot,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Send a reset link, if that address has an account.

    Answers identically whether or not it does, and whether or not the mail
    actually went out. Anything else turns this into a way to ask the platform
    which agencies are on it.

    The mail goes out *after* the response, on a background task. Sending it
    inline made the reply slow by however long an SMTP round trip takes, but
    only for addresses that have an account — so the response time answered the
    question the identical bodies exist to refuse.
    """
    email = body.email.strip().lower()
    ip_key = f"{client_key(request)}:forgot"
    id_key = f"forgot:{email}"
    enforce_rate_limit(db, {id_key: FORGOT_LIMIT, ip_key: FORGOT_IP_LIMIT})
    # Every attempt counts, not just failures: the cost being metered here is
    # mail sent to somebody's inbox, and a request that finds a real account is
    # exactly the one worth limiting.
    record(db, id_key, ip_key)

    host = (
        db.query(Host)
        .filter(Host.email == email, Host.deleted_at.is_(None))
        .first()
    )
    if host:
        # Both the row and the mail are issued after the response. Backgrounding
        # only the mail left the INSERT as the tell — measured against the
        # pooler it was worth most of a second, which is plenty to read an
        # answer out of.
        token = secrets.token_urlsafe(32)
        background.add_task(
            _issue_reset,
            HostPasswordReset(token_hash=_reset_hash(token), host_id=host.id),
            token,
            host.email,
            host.name,
            "/host/reset",
            "this organizer account",
        )
    return {"sent": True}


def _issue_reset(
    reset: HostPasswordReset | MemberPasswordReset,
    token: str,
    email: str,
    name: str,
    path: str,
    what: str,
) -> None:
    """Record the reset and mail the link. Runs after the response has gone.

    Opens its own session: the request's is closed by the time this runs.
    """
    reset.expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=RESET_TTL_MINUTES
    )
    db = SessionLocal()
    try:
        db.add(reset)
        db.commit()
    finally:
        db.close()

    link = f"{settings.FRONTEND_ORIGIN}{path}/{token}"
    send_mail(
        email,
        "Reset your Belonging Collective password",
        f"""Hello {name},

Someone asked to reset the password for {what}.

Open this link to choose a new one. It works once, and expires in one hour:

{link}

If it wasn't you, nothing has changed — ignore this and your password stays
as it is.
""",
        button=("Choose a new password", link),
    )


def _usable_reset(db: Session, token: str, model=HostPasswordReset):
    reset = (
        db.query(model).filter(model.token_hash == _reset_hash(token)).first()
    )
    if not reset or reset.used_at is not None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That reset link is no longer valid."
        )
    if reset.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status.HTTP_410_GONE, "That reset link has expired — ask for a new one."
        )
    return reset


@router.get("/host/reset/{token}")
def preview_host_reset(token: str, db: Session = Depends(get_db)):
    """What the reset page shows before anyone types a password. Returns the
    address the link was issued for, so somebody holding two accounts can see
    which one they are about to change."""
    reset = _usable_reset(db, token)
    host = db.get(Host, reset.host_id)
    if not host or host.deleted_at is not None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That reset link is no longer valid."
        )
    org = host.org if host.org_id else host
    return {"email": host.email, "organization": org.name}


@router.post("/host/reset")
def reset_host_password(
    body: HostReset,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Set the new password and sign them straight in.

    Every other outstanding reset for the account is spent at the same time: if
    a few links were requested, the one that gets used is the only one that
    should ever work.
    """
    ip_key = f"{client_key(request)}:reset"
    enforce_rate_limit(db, {ip_key: IP_LIMIT})
    try:
        reset = _usable_reset(db, body.token)
    except HTTPException:
        record(db, ip_key)
        raise

    host = db.get(Host, reset.host_id)
    if not host or host.deleted_at is not None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That reset link is no longer valid."
        )

    now = datetime.now(timezone.utc)
    host.password_hash = hash_password(body.password)
    db.query(HostPasswordReset).filter(
        HostPasswordReset.host_id == host.id,
        HostPasswordReset.used_at.is_(None),
    ).update({HostPasswordReset.used_at: now}, synchronize_session=False)
    db.commit()
    db.refresh(host)
    # Sessions opened with the old password stop working here, because the
    # token carries a fingerprint of it — which is the point when the reason
    # for the reset is that somebody else had it.
    set_auth_cookie(
        response,
        create_access_token(
            host.id,
            "host",
            is_admin=host.is_superadmin,
            cred_hash=credential_fingerprint(host.password_hash),
        ),
    )
    return {"id": str(host.id), "email": host.email, "is_admin": host.is_superadmin}


# ---------- Member password reset ----------
#
# The same flow as the organizer one above. Since icon keys were retired
# this is the only recovery a member can do alone; the other is a superadmin
# setting a temporary password from the console.


@router.post("/forgot")
def forgot_user_password(
    body: UserForgot,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Answers identically whether or not the address has an account — see
    forgot_host_password."""
    email = body.email.strip().lower()
    ip_key = f"{client_key(request)}:forgot"
    id_key = f"forgot-user:{email}"
    enforce_rate_limit(db, {id_key: FORGOT_LIMIT, ip_key: FORGOT_IP_LIMIT})
    record(db, id_key, ip_key)

    user = _live_member_by_email(db, email)
    if user:
        token = secrets.token_urlsafe(32)
        background.add_task(
            _issue_reset,
            MemberPasswordReset(token_hash=_reset_hash(token), user_id=user.id),
            token,
            user.email,
            user.first_name,
            "/reset",
            "your Belonging Collective account",
        )
    return {"sent": True}


def _member_for_reset(db: Session, reset: MemberPasswordReset) -> User:
    user = db.get(User, reset.user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That reset link is no longer valid."
        )
    return user


@router.get("/reset/{token}")
def preview_user_reset(token: str, db: Session = Depends(get_db)):
    user = _member_for_reset(db, _usable_reset(db, token, MemberPasswordReset))
    return {"email": user.email, "first_name": user.first_name}


@router.post("/reset")
def reset_user_password(
    body: UserReset,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Set the new password and sign them straight in, spending every other
    outstanding reset for the account. A legacy icon account that had added
    an email becomes a password account here."""
    ip_key = f"{client_key(request)}:reset"
    enforce_rate_limit(db, {ip_key: IP_LIMIT})
    try:
        reset = _usable_reset(db, body.token, MemberPasswordReset)
    except HTTPException:
        record(db, ip_key)
        raise
    user = _member_for_reset(db, reset)

    user.password_hash = hash_password(body.password)
    user.auth_type = "password"
    db.query(MemberPasswordReset).filter(
        MemberPasswordReset.user_id == user.id,
        MemberPasswordReset.used_at.is_(None),
    ).update(
        {MemberPasswordReset.used_at: datetime.now(timezone.utc)},
        synchronize_session=False,
    )
    db.commit()
    db.refresh(user)
    # Old sessions end here — the token's fingerprint no longer matches.
    _sign_in_member(response, user)
    return {"id": str(user.id), "email": user.email, "role": "user"}


# ---------- Session ----------


@router.post("/logout")
def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}


@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(settings.COOKIE_NAME)
    payload = decode_token(token) if token else None
    if not payload:
        return {"authenticated": False}
    role = payload.get("role")
    is_admin = payload.get("is_admin", False)
    member: User | None = None
    if role == "user":
        # Same reasoning as the host branch below: the token outlives the
        # account. Without this an archived member's session still reports
        # authenticated here, so the UI lets them in and every real endpoint
        # then 401s.
        user = db.get(User, uuid.UUID(payload["sub"]))
        if not user or user.deleted_at is not None:
            return {"authenticated": False}
        # And the same again for a re-issued key: this is the gate the UI reads,
        # so it has to agree with deps._key_still_current or the member is shown
        # a signed-in app in which nothing works.
        if payload.get("cv") != credential_fingerprint(user.password_hash):
            return {"authenticated": False}
        member = user
    if role == "host":
        # Tokens last a week and carry whatever is_admin was true at login, so a
        # demoted superadmin would keep seeing superadmin UI until it expired.
        # The DB is the authority (require_admin already reads it) — read it here
        # too so the UI matches what the API will actually allow.
        # Archived too (the organization as well, for a staff login):
        # get_current_host refuses these, so reporting the session as live
        # here would hand a removed organizer a console in which every
        # request fails.
        host = load_live_host(db, uuid.UUID(payload["sub"]))
        if not host:
            return {"authenticated": False}
        # And the same fingerprint check the API applies, so a reset organizer
        # isn't shown a console in which nothing works.
        if payload.get("cv") != credential_fingerprint(host.password_hash):
            return {"authenticated": False}
        is_admin = host.is_superadmin
    out = {
        "authenticated": True,
        "role": role,
        "is_admin": is_admin,
        "id": payload.get("sub"),
    }
    if role == "host":
        # The organization the login acts for — the console's ownership
        # comparisons read this, so a staff login sees its agency's programs
        # as its own.
        out["org_id"] = str(org_id_of(host))
    if member:
        out["email"] = member.email
        out["auth_type"] = member.auth_type
        out["avatar_url"] = member.avatar_url
        out["avatar_emblem"] = member.avatar_emblem
        # What the feed needs before its first paint: which layout to draw,
        # which recommendations to skip, and whether to run the tour.
        out["preferred_view"] = member.preferred_view
        out["dismissed_program_ids"] = member.dismissed_program_ids
        out["onboarded_at"] = member.onboarded_at
        # What the calendar buttons offer: connected, available or off.
        out["google_calendar"] = member.google_calendar
        # Care links, both ways: who this account saves for, and who may
        # save for it (first name and initial only).
        out["is_caregiver"] = member.is_caregiver
        out["care"] = [
            CarePerson.model_validate(u).model_dump(mode="json") for u in member.care
        ]
        out["caregivers"] = [
            CarePerson.model_validate(c).model_dump(mode="json")
            for c in member.caregivers
        ]
    return out
