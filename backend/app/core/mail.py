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
BAND = "#e5faff"
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
    # Full width, the design's email button.
    return (
        f'<p style="margin:8px 0 24px"><a href="{html.escape(url, quote=True)}" '
        f'style="display:block;padding:14px 20px;border-radius:12px;text-align:center;'
        f"border:2px solid {BUTTON_EDGE};background:{BUTTON};color:{INK};"
        f'font-size:17px;font-weight:600;text-decoration:none">{html.escape(label)}</a></p>'
    )


def _card(lines: list[str], picture: str | None) -> str:
    """A program: its picture beside the title and facts, as the design's
    event list email draws it. Without a picture, the text alone."""
    title, rest = lines[0], lines[1:]
    text = (
        f'<p style="margin:0;font-size:18px;font-weight:600;line-height:1.35;color:{INK}">'
        f"{html.escape(title)}</p>"
        + "".join(
            f'<p style="margin:6px 0 0;font-size:16px;line-height:1.45;color:{MUTED}">'
            f"{_line(line)}</p>"
            for line in rest
        )
    )
    image = (
        f'<td width="120" style="width:120px;padding:0 16px 0 0;vertical-align:top">'
        # Width only: mail apps ignore object-fit, so a fixed height would
        # squash any picture that isn't square.
        f'<img src="{html.escape(picture, quote=True)}" alt="" width="120" '
        f'style="display:block;width:120px;height:auto;border-radius:12px;border:0"></td>'
        if picture
        else ""
    )
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
        'style="margin:0 0 20px;border-collapse:collapse">'
        f'<tr>{image}<td style="vertical-align:top">{text}</td></tr></table>'
    )


def render_html(
    body: str,
    button: tuple[str, str] | None = None,
    pictures: list[str | None] | None = None,
) -> str:
    """The HTML half of a message, from the plain text.

    Blank lines split blocks. A one-line block is a paragraph; a block of
    several lines is a program (title, when, where, calendar link) and is
    drawn as a card with its first line as the title. "Label: https://…"
    lines become a link named by the label, so nobody reads a raw `.ics`
    address. The button goes where its URL stood on its own — "open this
    link:" is followed by the button, not by the sign-off — or at the end.
    `pictures` go with the program cards in order, one per card.
    """
    blocks = []
    placed = False
    cards = iter(pictures or [])
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
            blocks.append(_card(lines, next(cards, None)))
    if button and not placed:
        blocks.append(_button(*button))

    logo = html.escape(f"{settings.FRONTEND_ORIGIN}/kwhab-logo.png", quote=True)
    home = html.escape(settings.FRONTEND_ORIGIN, quote=True)
    return f"""<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px 12px;background:{PAGE};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid {LINE};border-radius:20px;overflow:hidden">
    <div style="background:{BAND};border-bottom:1px solid {BUTTON_EDGE};padding:16px;text-align:center">
      <img src="{logo}" alt="KW Habilitation" height="40" style="display:inline-block;height:40px;width:auto;border:0">
    </div>
    <div style="padding:28px">
      {''.join(blocks)}
    </div>
  </div>
  <p style="max-width:600px;margin:16px auto 0;text-align:center;font-size:13px;line-height:1.5;color:{MUTED}">
    <a href="{home}" style="color:{MUTED};text-decoration:underline">{BRAND}</a> · Kitchener-Waterloo
  </p>
</body>
</html>
"""


def send(
    to: str,
    subject: str,
    body: str,
    button: tuple[str, str] | None = None,
    pictures: list[str | None] | None = None,
) -> bool:
    """Send one message, text plus HTML. True if it was handed to the server.

    `button` is (label, url) — the one action the mail exists for.
    `pictures` are the programs' images, in the order the body lists them.

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
    message.add_alternative(render_html(body, button, pictures), subtype="html")

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
