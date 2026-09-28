/**
 * Is this occurrence still to come?
 *
 * Measured from when it *ends*, not from midnight and not from when it starts.
 * The feed used to keep a program until the end of the day, so a Friday coffee
 * morning still read as upcoming all Friday afternoon; the saved panel used the
 * start instead, so the same program dropped off the moment it began. Two
 * surfaces, two answers, both wrong in different directions.
 *
 * An undated program is upcoming — "date to be announced" hasn't happened yet.
 * With no end time, the start is the best we have.
 */
export function isUpcoming(ev: {
  starts_at?: string | null;
  ends_at?: string | null;
}): boolean {
  const finish = ev.ends_at ?? ev.starts_at;
  if (!finish) return true;
  const at = new Date(finish).getTime();
  return Number.isNaN(at) ? true : at >= Date.now();
}

/**
 * Which session of a run this is — "3 of 16".
 *
 * The feed shows a repeating program once, at its next date, so this says where
 * in the run that date falls. It advances on its own: once this week's session
 * has finished the card moves to the next one, and the count moves with it.
 */
export function sessionLabel(ev: {
  series_index?: number | null;
  series_total?: number | null;
}): string | null {
  const { series_index: at, series_total: of } = ev;
  if (!at || !of || of < 2) return null;
  return `${at} of ${of}`;
}

/** Human "in 3 days" / "in 5 hours" / "starting now" from an ISO timestamp. */
export function countdown(iso?: string | null): string {
  if (!iso) return "Date to be announced";
  const start = new Date(iso).getTime();
  const diffMs = start - Date.now();

  if (diffMs <= 0) return "Happening now";

  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 1) return "in less than an hour";
  if (hours < 24) return `in ${hours} ${hours === 1 ? "hour" : "hours"}`;

  const days = Math.round(hours / 24);
  if (days < 7) return `in ${days} ${days === 1 ? "day" : "days"}`;

  const weeks = Math.round(days / 7);
  return `in ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

/**
 * Everything below renders in America/Toronto, whoever is looking. The
 * programs happen in Kitchener-Waterloo; a caregiver checking from another
 * zone still wants the time on the door, not the time on their laptop.
 */
export const TIME_ZONE = "America/Toronto";

/** Calendar day in Toronto as a UTC-midnight timestamp, so days subtract. */
function torontoDay(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"));
}

/** Toronto calendar days from `now` to `at`: 0 today, 1 tomorrow, -1 yesterday. */
function dayOffset(at: Date, now: Date): number {
  return Math.round((torontoDay(at) - torontoDay(now)) / 86_400_000);
}

/**
 * "Today", "Tomorrow", "In 7 days", "In 3 weeks"; "Yesterday", "5 days ago".
 * Counted in Toronto calendar days, so a 1 AM program is "Tomorrow" all
 * evening rather than "Today" once the clock passes 1 AM UTC-equivalent.
 */
export function relativeDay(iso?: string | null, now = new Date()): string {
  if (!iso) return "Date to be announced";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "Date to be announced";
  const days = dayOffset(at, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  const n = Math.abs(days);
  const unit = n < 14 ? `${n} days` : `${Math.round(n / 7)} weeks`;
  return days > 0 ? `In ${unit}` : `${unit} ago`;
}

/** "August 28, 2026". */
export function longDate(iso?: string | null): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleDateString("en-CA", {
    timeZone: TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "1:00PM", as the design sets it — no space before the meridiem. */
export function clockTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-CA", {
      timeZone: TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
    })
    .replace(/\s?([ap])\.?m\.?$/i, (_, m: string) => `${m.toUpperCase()}M`);
}

/** "1:00PM - 3:00PM", or just the start when there is no end. */
export function timeRange(
  start?: string | null,
  end?: string | null,
): string {
  if (!start || Number.isNaN(new Date(start).getTime())) return "";
  const from = clockTime(start);
  if (!end || Number.isNaN(new Date(end).getTime())) return from;
  return `${from} - ${clockTime(end)}`;
}

/**
 * The card's two-line "when": `day` is "In 7 days · August 28, 2026" and
 * `time` is "1:00PM - 3:00PM". An undated program gets the placeholder and
 * an empty time. `rel` and `date` are the two halves of `day`, for a layout
 * that wants to keep each on one line.
 */
export function whenLine(ev: {
  starts_at?: string | null;
  ends_at?: string | null;
}): { day: string; rel: string; date: string; time: string } {
  const date = longDate(ev.starts_at);
  const rel = relativeDay(ev.starts_at);
  return {
    day: date ? `${rel} · ${date}` : rel,
    rel,
    date,
    time: timeRange(ev.starts_at, ev.ends_at),
  };
}
