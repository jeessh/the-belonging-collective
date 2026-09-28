"""Endpoints for the scheduler, not for people.

Vercel Cron issues a GET with `Authorization: Bearer $CRON_SECRET` (see the
`crons` entry in the root vercel.json). Nothing else may call these.
"""

import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core import member_mail
from app.core.config import settings

router = APIRouter(prefix="/internal", tags=["internal"])


def require_cron(authorization: str | None = Header(None)) -> None:
    # Unset is refused outright rather than treated as "no secret needed":
    # a missing variable must not turn a scheduler hook into a public one.
    if not settings.CRON_SECRET:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "CRON_SECRET is not configured."
        )
    expected = f"Bearer {settings.CRON_SECRET}"
    if not authorization or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authorized")


@router.get("/reminders", dependencies=[Depends(require_cron)])
def run_reminders(db: Session = Depends(get_db)):
    """Mail tomorrow's reminders. Idempotent: rows already reminded are skipped."""
    return member_mail.send_reminders(db)
