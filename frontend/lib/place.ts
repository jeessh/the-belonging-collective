import type { Event } from "@/lib/api";

/**
 * A virtual event's location is its meeting link when the organizer gave
 * one (the console's "Meeting link" box). Anything else in it — "Online",
 * "Zoom — link sent after sign-up" — is words, and is shown as they are.
 */
export function meetingUrl(event: Pick<Event, "is_virtual" | "location">): string | null {
  const loc = event.location?.trim();
  if (!event.is_virtual || !loc) return null;
  if (/^https?:\/\/\S+$/i.test(loc)) return loc;
  // "meet.google.com/abc-defg-hij" typed without the https://.
  if (/^[\w-]+(\.[\w-]+)+\/\S*$/.test(loc)) return `https://${loc}`;
  return null;
}

/** What an event's "where" line says: a link reads as "Online". */
export function placeLabel(event: Pick<Event, "is_virtual" | "location">): string {
  if (meetingUrl(event)) return "Online";
  return event.location || (event.is_virtual ? "Online" : "Location to be announced");
}
