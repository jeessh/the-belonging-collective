import { API, type Event } from "@/lib/api";

/** "20260828T170000Z" — the compact UTC form Google's template URL wants. */
function stamp(at: Date): string {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * A Google Calendar "add this event" link, built entirely client-side: it
 * opens the member's own calendar with the event filled in, one click from
 * saved. Null for an undated program — there is nothing to put on a calendar.
 * In the browser the details end with the program's page, so the calendar
 * entry leads back to its links and registration.
 */
export function googleCalendarUrl(event: Event): string | null {
  if (!event.starts_at) return null;
  const start = new Date(event.starts_at);
  if (Number.isNaN(start.getTime())) return null;
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const finish =
    end && !Number.isNaN(end.getTime())
      ? end
      : new Date(start.getTime() + 60 * 60 * 1000);
  const page =
    typeof window === "undefined"
      ? null
      : `${window.location.origin}/events/${event.id}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${stamp(start)}/${stamp(finish)}`,
    details: [event.description, page].filter(Boolean).join("\n\n"),
    location: event.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Google Calendar in a new tab, from a click (so no popup blocker). */
export function openGoogleCalendar(event: Event): void {
  const url = googleCalendarUrl(event);
  if (url) window.open(url, "_blank", "noopener");
}

/** Every saved program as one `.ics`; the API needs the auth cookie. */
export const savedCalendarUrl = `${API}/users/me/events/calendar.ics`;
