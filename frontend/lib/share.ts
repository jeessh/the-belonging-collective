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
 * The plain-text lines everyone gets: title, when, where, link, and — for a
 * single program — the calendar link. Dates are fixed ("Monday, October 19"),
 * since "Tomorrow" is wrong by the time the message is read.
 */
export function eventShareText(
  event: Event,
  url: string,
  { calendar = true }: { calendar?: boolean } = {},
): string {
  const when = whenLine(event, { fixed: true });
  const calendarUrl = calendar ? googleCalendarUrl(event) : null;
  return [
    event.title,
    `${when.day}${when.time ? `, ${when.time}` : ""}`,
    event.location ?? (event.is_virtual ? "Online" : null),
    url,
    calendarUrl ? `Add to Google Calendar: ${calendarUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * One block per program, for the saved list. No calendar links: each is
 * several hundred characters, and with a handful of programs the `mailto:`
 * grew past what mail apps accept, so Send did nothing. The program's own
 * page has the button.
 */
export function listShareText(events: Event[], origin: string): string {
  return events
    .map((ev) =>
      eventShareText(ev, publicEventUrl(ev.id, origin), { calendar: false }),
    )
    .join("\n\n");
}

/** A `mailto:` the browser hands to whatever mail app the member has. */
export function mailtoUrl(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({ subject, body });
  // URLSearchParams writes spaces as "+", which mail clients read literally.
  return `mailto:${encodeURIComponent(to.trim())}?${params
    .toString()
    .replace(/\+/g, "%20")}`;
}
