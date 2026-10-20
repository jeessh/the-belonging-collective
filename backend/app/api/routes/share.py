"""Share by email: a member's programs, sent by the site to an address they
type.

Sent here rather than through the member's own mail app because a `mailto:`
can only carry plain text, and the designed message (logo, picture, button)
is the point. Signed-in members only, with a daily cap, so the form can't be
used to mail strangers in bulk; what goes out is only ever our own program
cards.
"""

import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_current_user, get_db
from app.core import mail, member_mail
from app.core.access import visible_to_member
from app.core.config import settings
from app.core.rate_limit import enforce, record
from app.models.event import Event
from app.models.user import User

router = APIRouter(tags=["share"])

# Messages per member per day. Enough to tell a few friends about a few
# programs; too few to be worth abusing.
SHARE_LIMIT = 20
SHARE_WINDOW = 24 * 60 * 60


class ShareIn(BaseModel):
    to: EmailStr
    event_ids: list[uuid.UUID] = Field(min_length=1, max_length=50)
    # Include the member's live list page (their share link) as the button.
    with_list_link: bool = False


@router.post("/share/email", status_code=status.HTTP_204_NO_CONTENT)
def share_by_email(
    body: ShareIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not mail.configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Email isn't set up on this site yet. Copy the link instead.",
        )
    key = f"user:{user.id}:share"
    enforce(db, {key: SHARE_LIMIT}, window=SHARE_WINDOW)

    events = (
        db.query(Event)
        .options(joinedload(Event.host), selectinload(Event.images))
        .filter(
            Event.id.in_(body.event_ids),
            Event.deleted_at.is_(None),
            visible_to_member(user.id),
        )
        .order_by(Event.starts_at.asc().nullslast(), Event.id.asc())
        .all()
    )
    if not events:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    list_url = None
    if body.with_list_link:
        # Made on first use, as POST /users/me/share-link does.
        if not user.share_token:
            user.share_token = secrets.token_urlsafe(24)
            db.commit()
        list_url = f"{settings.FRONTEND_ORIGIN}/shared/{user.share_token}"
    record(db, key, window=SHARE_WINDOW)
    if not member_mail.send_share(user, str(body.to), events, list_url):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Couldn't send that email. Please try again.",
        )
