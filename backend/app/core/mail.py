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
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import settings

log = logging.getLogger(__name__)

BRAND = "The Belonging Collective"


def configured() -> bool:
    return bool(settings.SMTP_HOST and settings.MAIL_FROM)


# The app's own palette (frontend/tailwind.config.ts): ink on white, the
# cyan button, the card hairline.
INK = "#1a1a1a"
MUTED = "#6d6d6d"
LINE = "#dcdcdc"
PAGE = "#f1f1f1"
BUTTON = "#94eaff"
BUTTON_EDGE = "#00cdff"
LINK = "#004bde"

# "Add to calendar: https://…" — a line that is a label and a link.
LABELLED_URL = re.compile(r"^(?P<label>[^:]+):\s+(?P<url>https?://\S+)$")
URL = re.compile(r"^https?://\S+$")


def _link(label: str, url: str) -> str:
    return (
        f'<a href="{html.escape(url, quote=True)}" style="color:{LINK};'
        f'text-decoration:underline">{html.escape(label)}</a>'
    )


def _line(text: str) -> str:
    """One line of the plain text, with its link made clickable."""
    m = LABELLED_URL.match(text)
    if m:
        return _link(m["label"], m["url"])
    if URL.match(text):
        return _link(text, text)
    return html.escape(text)


def _button(label: str, url: str) -> str:
    return (
        f'<p style="margin:8px 0 24px"><a href="{html.escape(url, quote=True)}" '
        f'style="display:inline-block;padding:14px 28px;border-radius:12px;'
        f"border:2px solid {BUTTON_EDGE};background:{BUTTON};color:{INK};"
        f'font-size:17px;font-weight:600;text-decoration:none">{html.escape(label)}</a></p>'
    )


def render_html(body: str, button: tuple[str, str] | None = None) -> str:
    """The HTML half of a message, from the plain text.

    Blank lines split blocks. A one-line block is a paragraph; a block of
    several lines is a program (title, when, where, calendar link) and is
    drawn as a card with its first line as the title. "Label: https://…"
    lines become a link named by the label, so nobody reads a raw `.ics`
    address. The button goes where its URL stood on its own — "open this
    link:" is followed by the button, not by the sign-off — or at the end.
    """
    blocks = []
    placed = False
    for block in body.strip().split("\n\n"):
        lines = [line.strip() for line in block.strip().split("\n") if line.strip()]
        if not lines:
            continue
        if button and lines == [button[1]]:
            # The text said "open this link", so the link itself stays too,
            # small, for a mail app that won't draw the button.
            blocks.append(
                _button(*button).replace("margin:8px 0 24px", "margin:8px 0")
                + f'<p style="margin:0 0 24px;font-size:13px;line-height:1.4;'
                f'color:{MUTED};word-break:break-all">{html.escape(button[1])}</p>'
            )
            placed = True
        elif len(lines) == 1:
            blocks.append(
                f'<p style="margin:0 0 16px;font-size:17px;line-height:1.5;color:{INK}">'
                f"{_line(lines[0])}</p>"
            )
        else:
            title, rest = lines[0], lines[1:]
            details = "".join(
                f'<p style="margin:4px 0 0;font-size:16px;line-height:1.45;color:{MUTED}">'
                f"{_line(line)}</p>"
                for line in rest
            )
            blocks.append(
                f'<div style="margin:0 0 16px;padding:16px 20px;border:1px solid {LINE};'
                f'border-radius:14px">'
                f'<p style="margin:0;font-size:18px;font-weight:600;line-height:1.35;color:{INK}">'
                f"{html.escape(title)}</p>{details}</div>"
            )
    if button and not placed:
        blocks.append(_button(*button))

    logo = html.escape(f"{settings.FRONTEND_ORIGIN}/kwhab-logo.png", quote=True)
    home = html.escape(settings.FRONTEND_ORIGIN, quote=True)
    return f"""<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px 12px;background:{PAGE};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid {LINE};border-radius:20px;padding:28px">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:collapse">
      <tr>
        <td style="padding:0 12px 0 0;vertical-align:middle"><img src="{logo}" alt="KW Habilitation" height="36" style="display:block;height:36px;width:auto;border:0"></td>
        <td style="padding:0 0 0 12px;border-left:1px solid {LINE};vertical-align:middle;font-size:18px;font-weight:600;color:{INK}">{BRAND}</td>
      </tr>
    </table>
    {''.join(blocks)}
  </div>
  <p style="max-width:560px;margin:16px auto 0;text-align:center;font-size:13px;line-height:1.5;color:{MUTED}">
    <a href="{home}" style="color:{MUTED};text-decoration:underline">{BRAND}</a> · Kitchener-Waterloo
  </p>
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
