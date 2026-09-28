import {
  API,
  createCalendarFeed,
  type Event,
  type GoogleCalendarState,
} from "@/lib/api";
import type { ToastOptions } from "@/components/ui/Toast";

const GOOGLE_CALENDAR = "https://calendar.google.com/calendar/r";

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

/**
 * Google Calendar's "subscribe by URL" page for the member's private feed.
 * Google fetches the feed from its own servers, hence a token rather than
 * the cookie, and re-reads it every few hours on its own schedule.
 */
function googleSubscribeUrl(feedToken: string): string {
  const feed = new URL(
    `${API}/calendar/${feedToken}.ics`,
    window.location.origin,
  ).href.replace(/^https?:/, "webcal:");
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feed)}`;
}

/**
 * Subscribes the signed-in member's Google Calendar to their saved list: one
 * "Add" in Google and every save lands in their calendar, and an un-save
 * leaves it, with nothing more to click. Call it from a click — the tab opens
 * before the token arrives, because one opened after an await is a popup the
 * browser blocks. Throws, with the tab closed, when there is no token.
 *
 * Once Google has fetched the feed it is already in their calendar, and a
 * second "Add" would list it twice: the tab opens Google Calendar instead
 * and this returns "already". `again` skips that, for a member who removed
 * it and wants it back.
 */
async function subscribeInGoogleCalendar(
  again = false,
): Promise<"added" | "already"> {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;
  try {
    const feed = await createCalendarFeed();
    const already = feed.subscribed && !again;
    const url = already ? GOOGLE_CALENDAR : googleSubscribeUrl(feed.token);
    if (tab) tab.location.href = url;
    else window.location.href = url;
    return already ? "already" : "added";
  } catch (err) {
    tab?.close();
    throw err;
  }
}

/**
 * What the "Google Calendar" buttons do, by `Me.google_calendar`:
 * `connected` opens Google Calendar, where the saved list already is;
 * `available` connects (Google's consent page, then back to the feed with
 * `?calendar=…`); `off` — Google sign-in not set up — subscribes instead,
 * or opens Google Calendar when it already is, saying so with `show`.
 */
export async function googleCalendarButton(
  state: GoogleCalendarState | undefined,
  show?: (opts: ToastOptions) => number,
): Promise<void> {
  if (state === "connected") {
    window.open(GOOGLE_CALENDAR, "_blank", "noopener");
  } else if (state === "available") {
    window.location.href = `${API}/google-calendar/connect`;
  } else if ((await subscribeInGoogleCalendar()) === "already") {
    show?.({
      title: "Already in your Google Calendar",
      description: "It updates by itself when you save or un-save.",
      tone: "info",
      action: {
        label: "Add it again",
        onClick: () => void subscribeInGoogleCalendar(true).catch(() => {}),
      },
    });
  }
}

/** Every saved program as one `.ics`; the API needs the auth cookie. */
export const savedCalendarUrl = `${API}/users/me/events/calendar.ics`;
