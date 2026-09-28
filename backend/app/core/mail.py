"""Outbound email, branded "The Belonging Collective".

Organizer mail (password resets, invitations) and member mail (day-before
reminders, change notices — only to members who chose to add an email).

Every message goes out multipart: the plain text the caller wrote, plus a
small HTML rendering of it — wordmark, one message block, one button — built
here so no caller has to touch markup.

Plain smtplib rather than a provider SDK. It adds no dependency, and a nonprofit
that already has Microsoft 365 or Google Workspace can point it at their own
mailbox instead of signing up for a sending service.
"""

import html
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import settings

log = logging.getLogger(__name__)

BRAND = "The Belonging Collective"


def configured() -> bool:
    return bool(settings.SMTP_HOST and settings.MAIL_FROM)


def render_html(body: str, button: tuple[str, str] | None = None) -> str:
    """The HTML half of a message. `body` is the plain text: blank lines split
    paragraphs, and a line that is only a URL is dropped when it is the
    button's — the button already carries it."""
    paragraphs = []
    for block in body.strip().split("\n\n"):
        block = block.strip()
        if not block or (button and block == button[1]):
            continue
        paragraphs.append(
            f'<p style="margin:0 0 16px;font-size:17px;line-height:1.5;color:#1f1b2e">'
            f"{html.escape(block).replace(chr(10), '<br>')}</p>"
        )
    cta = ""
    if button:
        label, url = button
        cta = (
            f'<p style="margin:24px 0 8px"><a href="{html.escape(url, quote=True)}" '
            'style="display:inline-block;padding:14px 28px;border-radius:12px;'
            'background:#5b4b9a;color:#ffffff;font-size:17px;font-weight:600;'
            f'text-decoration:none">{html.escape(label)}</a></p>'
            f'<p style="margin:0;font-size:13px;color:#6b6480;word-break:break-all">'
            f"{html.escape(url)}</p>"
        )
    return f"""<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px 12px;background:#eeebf5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px 28px">
    <p style="margin:0 0 24px;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:#5b4b9a">{BRAND}</p>
    {''.join(paragraphs)}
    {cta}
  </div>
  <p style="max-width:560px;margin:16px auto 0;text-align:center;font-size:13px;color:#6b6480">{BRAND} · Kitchener-Waterloo</p>
</body>
</html>
"""


def send(
    to: str, subject: str, body: str, button: tuple[str, str] | None = None
) -> bool:
    """Send one message, text plus HTML. True if it was handed to the server.

    `button` is (label, url) — the one action the mail exists for.

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
        log.warning(
            "SMTP not configured; would have sent to %s [%s]:\n%s", to, subject, body
        )
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.MAIL_FROM_NAME, settings.MAIL_FROM))
    message["To"] = to
    message.set_content(body)
    message.add_alternative(render_html(body, button), subtype="html")

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
