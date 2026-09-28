"""Connect and disconnect Google Calendar (core/gcal.py does the work).

The browser goes to /google-calendar/connect, on to Google's consent page, and
back to /google-calendar/callback, which lands the member on the feed with
`?calendar=connected | cancelled | failed` for the toast.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_optional_user
from app.core import gcal
from app.core.config import settings
from app.models.user import User

router = APIRouter(tags=["google-calendar"])


def _back(outcome: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.FRONTEND_ORIGIN}/?calendar={outcome}", 302)


@router.get("/google-calendar/connect")
def connect(user: User = Depends(get_current_user)):
    if not gcal.available():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Google Calendar isn't set up")
    return RedirectResponse(gcal.auth_url(user), 302)


@router.get("/google-calendar/callback")
def callback(
    background: BackgroundTasks,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    if error or not code or not state:
        # `access_denied`: they pressed Cancel on Google's page.
        return _back("cancelled")
    # The state names who started, and the browser finishing must be signed in
    # as them — so a link can't attach somebody else's Google account.
    started_by = gcal.read_state(state)
    if not user or started_by != user.id:
        return _back("failed")
    try:
        gcal.finish_connect(db, user, code)
    except gcal.ScopeRefused:
        return _back("cancelled")
    except gcal.GoogleError:
        gcal.log.exception("Google Calendar connect failed for %s", user.id)
        return _back("failed")
    background.add_task(gcal.sync_member, user.id)
    return _back("connected")


@router.delete("/users/me/google-calendar", status_code=status.HTTP_204_NO_CONTENT)
def disconnect(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Stop syncing: the app's calendar leaves their account and the access
    goes back to Google."""
    gcal.disconnect(db, user)
