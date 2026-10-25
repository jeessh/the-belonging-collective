"""Adding people to a special-access group by email — no approval step.

The organization already knows who belongs, so what it adds is approved:

- an address with a live member account is approved into the group at once
  (a new membership, or an existing one moved to approved — whatever it was:
  requested, declined or revoked, the organization's own choice now decides);
- an address with no account gets an `AccessInvite`, and `apply_pending`
  turns it into an approved membership as soon as an account is made with
  that email. `auth.new_member` calls it, so every way of making a member
  account — sign-up, a caregiver, the console — picks invitations up.

Either way the person is emailed. Mail goes through `core/mail.send`, which
logs instead of sending when SMTP is unset.
"""

import logging
from datetime import datetime, timezone

from email_validator import EmailNotValidError, validate_email
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.mail import send as send_mail
from app.models.access import APPROVED, AccessGroup, AccessInvite, AccessMembership
from app.models.host import Host
from app.models.user import User

log = logging.getLogger(__name__)

MAX_PER_REQUEST = 50


def normalise(raw: str) -> str | None:
    """A usable address, lowercased, or None."""
    try:
        return validate_email(raw.strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError:
        return None


def _approve(db: Session, group: AccessGroup, user: User, by: Host | None) -> bool:
    """Approve `user` into `group`. False if they were already approved."""
    m = db.get(AccessMembership, {"user_id": user.id, "group_id": group.id})
    now = datetime.now(timezone.utc)
    if m is None:
        db.add(
            AccessMembership(
                user_id=user.id,
                group_id=group.id,
                status=APPROVED,
                decided_at=now,
                decided_by_host_id=by.id if by else None,
            )
        )
        return True
    if m.status == APPROVED:
        return False
    m.status = APPROVED
    m.decided_at = now
    m.decided_by_host_id = by.id if by else None
    return True


def add_people(db: Session, group: AccessGroup, emails: list[str], by: Host) -> dict:
    """Add each address to `group`. Returns what happened to each, for the
    console to report: `added` (approved now), `already` (already in, or
    already invited), `invited` (no account yet) and `invalid`."""
    org = group.host
    out: dict[str, list] = {"added": [], "already": [], "invited": [], "invalid": []}
    seen: set[str] = set()
    to_mail: list[tuple[str, str]] = []  # (address, "added" | "invited")

    for raw in emails[:MAX_PER_REQUEST]:
        if not raw.strip():
            continue
        email = normalise(raw)
        if email is None:
            out["invalid"].append(raw.strip())
            continue
        if email in seen:
            continue
        seen.add(email)

        user = (
            db.query(User)
            .filter(func.lower(User.email) == email, User.deleted_at.is_(None))
            .first()
        )
        if user is not None:
            if _approve(db, group, user, by):
                out["added"].append(
                    {"email": email, "name": f"{user.first_name} {user.last_name[:1]}.".strip()}
                )
                to_mail.append((email, "added"))
            else:
                out["already"].append(email)
            continue

        pending = (
            db.query(AccessInvite)
            .filter(
                AccessInvite.group_id == group.id,
                func.lower(AccessInvite.email) == email,
                AccessInvite.accepted_at.is_(None),
                AccessInvite.revoked_at.is_(None),
            )
            .first()
        )
        if pending is not None:
            out["already"].append(email)
            continue
        db.add(AccessInvite(group_id=group.id, email=email, invited_by_host_id=by.id))
        out["invited"].append(email)
        to_mail.append((email, "invited"))

    db.commit()

    for email, kind in to_mail:
        _mail(email, kind, group.name, org.name if org else "An organization")
    return out


def _mail(email: str, kind: str, group: str, org: str) -> None:
    site = settings.FRONTEND_ORIGIN
    if kind == "added":
        send_mail(
            email,
            f"{org} added you to {group}",
            f"""Hello,

{org} added you to "{group}" on The Belonging Collective. You can now see and save the programs they run for this group.

{site}/

If you weren't expecting this, you can ignore it.
""",
            button=("See programs", f"{site}/"),
        )
    else:
        link = f"{site}/signup"
        send_mail(
            email,
            f"{org} invited you to The Belonging Collective",
            f"""Hello,

{org} added you to "{group}" on The Belonging Collective, where you can find and save community programs.

Create your free account with this email address ({email}) and you'll be in the group straight away, able to see and save its programs:

{link}

If you weren't expecting this, you can ignore it.
""",
            button=("Create your account", link),
        )


def apply_pending(db: Session, user: User) -> int:
    """Turn the invitations waiting for `user.email` into approved
    memberships. Called whenever a member account is created. Never raises:
    an account must not fail to open over a group."""
    if not user.email:
        return 0
    try:
        invites = (
            db.query(AccessInvite)
            .join(AccessGroup, AccessGroup.id == AccessInvite.group_id)
            .filter(
                func.lower(AccessInvite.email) == user.email.lower(),
                AccessInvite.accepted_at.is_(None),
                AccessInvite.revoked_at.is_(None),
                AccessGroup.deleted_at.is_(None),
            )
            .all()
        )
        now = datetime.now(timezone.utc)
        for inv in invites:
            by = db.get(Host, inv.invited_by_host_id) if inv.invited_by_host_id else None
            _approve(db, inv.group, user, by)
            inv.accepted_at = now
            inv.accepted_user_id = user.id
        if invites:
            db.commit()
        return len(invites)
    except Exception:
        db.rollback()
        log.exception("Couldn't apply access invitations for %s", user.id)
        return 0
