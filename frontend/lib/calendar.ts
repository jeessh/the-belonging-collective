import { API, type Event } from "@/lib/api";

/** "20260828T170000Z" — the compact UTC form Google's template URL wants. */
function stamp(at: Date): string {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * A Google Calendar "add this event" link, built entirely client-side. Null
 * for an undated program — there is nothing to put on a calendar.
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
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${stamp(start)}/${stamp(finish)}`,
    details: event.description ?? "",
    location: event.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Every saved program as one `.ics`; the API needs the auth cookie. */
export const savedCalendarUrl = `${API}/users/me/events/calendar.ics`;
