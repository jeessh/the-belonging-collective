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
