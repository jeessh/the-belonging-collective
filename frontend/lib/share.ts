import type { Event } from "@/lib/api";
import { googleCalendarUrl } from "@/lib/calendar";
import { whenLine } from "@/lib/time";

/** A Google Maps search for the free-text location — there are no coordinates. */
export function mapsUrl(location?: string | null): string | null {
  const q = location?.trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** The public page, at whichever origin this is running on. */
export function publicEventUrl(eventId: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/events/${eventId}`;
}

/** "example.org" for the "you are leaving" hint under a registration button. */
export function hostnameOf(url?: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * The plain-text block for one program: title, then labelled lines. The date
 * is the calendar date only — "In 2 days" is wrong by the time an email is
 * read.
 */
export function eventShareText(event: Event, url: string): string {
  const when = whenLine(event);
  const day = when.date || when.rel;
  const calendar = googleCalendarUrl(event);
  const where = event.location || (event.is_virtual ? "Online" : null);
  return [
    event.title,
    day ? `When: ${day}${when.time ? `, ${when.time}` : ""}` : null,
    where ? `Where: ${where}` : null,
    `Details: ${url}`,
    calendar ? `Add to Google Calendar: ${calendar}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** One block per program, for the saved list, under a line saying what it is. */
export function listShareText(events: Event[], origin: string): string {
  const intro =
    events.length === 1
      ? "Here's a program I saved on The Belonging Collective:"
      : `Here are ${events.length} programs I saved on The Belonging Collective:`;
  return [
    intro,
    ...events.map((ev) => eventShareText(ev, publicEventUrl(ev.id, origin))),
  ].join("\n\n");
}

/**
 * A `mailto:` the browser hands to whatever mail app the member has. Line
 * breaks go as CRLF, which the mailto standard (RFC 6068) asks for — some
 * mail apps run a bare "\n" body together onto one line.
 */
export function mailtoUrl(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({
    subject,
    body: body.replace(/\r?\n/g, "\r\n"),
  });
  // URLSearchParams writes spaces as "+", which mail clients read literally.
  return `mailto:${encodeURIComponent(to.trim())}?${params
    .toString()
    .replace(/\+/g, "%20")}`;
}
