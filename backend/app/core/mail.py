"""Outbound email.

Used for organizer mail only: password resets and invitations. Members are
never mailed — an icon account has no address, and a password account's email
is a sign-in name, not a channel.

Plain smtplib rather than a provider SDK. It adds no dependency, and a nonprofit
that already has Microsoft 365 or Google Workspace can point it at their own
mailbox instead of signing up for a sending service.
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

log = logging.getLogger(__name__)


def configured() -> bool:
    return bool(settings.SMTP_HOST and settings.MAIL_FROM)


def send(to: str, subject: str, body: str) -> bool:
    """Send one plain-text message. True if it was handed to the server.

    Never raises. The password-reset endpoint deliberately answers the same
    way whether or not the address exists — so it has to answer the same way
    when the mail server is down too, rather than turning a delivery failure
    into a 500 that tells the sender something about the account.
    """
    if not configured():
        # Unconfigured is the normal state locally. Log the message so the flow
        # can be completed in development without a mail server; the reset or
        # invite link is in the body, so this must never be enabled in
        # production — which is why it is tied to SMTP_HOST being unset rather
        # than to a flag somebody could turn on.
        log.warning("SMTP not configured; would have sent to %s:\n%s", to, body)
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.MAIL_FROM
    message["To"] = to
    message.set_content(body)

    try:
        if settings.SMTP_SSL:
            server = smtplib.SMTP_SSL(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=10,
                context=ssl.create_default_context(),
            )
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        with server:
            if settings.SMTP_STARTTLS and not settings.SMTP_SSL:
                server.starttls(context=ssl.create_default_context())
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(message)
        return True
    except Exception:
        # Logged, not raised — see the docstring.
        log.exception("Failed to send mail to %s", to)
        return False
