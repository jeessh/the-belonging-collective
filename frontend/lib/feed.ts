import type { Event } from "@/lib/api";
import { sameCategory } from "@/lib/categories";

// Weights for the personalized ordering.
//
// An access match outranks a topic match, which is the other way round from how
// this started. A topic is a preference — a wheelchair-accessible venue is not.
// Ranking it below the topic meant a cooking class up a flight of stairs came
// out above a step-free session for a member who uses a wheelchair, which is
// the wrong answer to a question about what they can attend rather than what
// they might enjoy.
//
// Ordering is all this can do about it: the feed sorts and never hides (see
// below), so a program that meets none of someone's needs still appears. Making
// needs *remove* programs would have to be the member's own explicit filter,
// and that is a separate decision — not least because most programs have no
// tags at all yet, so filtering today would empty the feed.
const TOPIC_WEIGHT = 3;
const ACCESS_WEIGHT = 5;

/**
 * The two profile fields that affect ordering. Taken as plain arrays rather
 * than the whole `Me` so callers can memoize on exactly what matters — patching
 * an unrelated preference (say, text-to-speech) hands back a new `Me` object
 * but the same arrays, and must not invalidate the feed.
 */
export type Taste = {
  interests: string[];
  accessPrefs: string[];
};

/**
 * How well one event matches this member. Higher sorts earlier; 0 means "no
 * signal", never "hide it".
 */
export function matchScore(event: Event, taste: Taste): number {
  let score = 0;
  if (taste.interests.some((c) => sameCategory(c, event.category))) {
    score += TOPIC_WEIGHT;
  }
  for (const pref of taste.accessPrefs) {
    if (event.accessibility_tags.includes(pref)) score += ACCESS_WEIGHT;
  }
  return score;
}

/**
 * Order the feed by match score without hiding anything — an explicitly
 * approved design rule: personalization reorders, it never filters. The only
 * things that remove cards are the member's own explicit filter choices.
 *
 * The server already returns a deterministic order (starts_at, created_at, id);
 * ties here fall back to that original index so the feed never reshuffles
 * between renders.
 */
/**
 * One card per program, rather than one per date.
 *
 * A weekly program is stored as a dated row per occurrence, because capacity,
 * saves and reminders each attach to a date and a virtual occurrence has
 * nothing to attach to. Browsing one at a time, that turned one agency's eight
 * programs into seventy near-identical cards — the same title twelve times over
 * before the feed moved on.
 *
 * Each series collapses to its soonest upcoming date, which is the one a member
 * can actually act on. The rest aren't dropped from the product: the card says
 * how often it repeats, and saving a series program still enrols them across
 * the run the same way it always did.
 *
 * Relies on a series' earliest date arriving first, which the server's
 * (starts_at, created_at, id) order gives and personalizedFeed preserves —
 * occurrences of one series all score the same, so nothing reorders them.
 */
export function oneCardPerProgram(events: Event[]): Event[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (!event.series_id) return true;
    if (seen.has(event.series_id)) return false;
    seen.add(event.series_id);
    return true;
  });
}

export function personalizedFeed(events: Event[], taste: Taste): Event[] {
  return events
    .map((event, index) => ({ event, index, score: matchScore(event, taste) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.event);
}

/** A program's id for dismissals: the series when there is one, else the row. */
export const programKey = (event: Event): string => event.series_id ?? event.id;

const WEEK_MS = 7 * 86_400_000;
const RECOMMENDED_MAX = 6;

/**
 * "For you this week": up to six programs that match the member and start in
 * the next seven days, best match first, one per program, minus the ones they
 * said were not for them. Empty for a member with nothing in their profile —
 * there is nothing to match against — and the feed itself never changes: this
 * is a section on top of it, not a filter on it.
 */
export function recommendedThisWeek(
  events: Event[],
  taste: Taste,
  dismissed: string[],
  now = Date.now(),
): Event[] {
  if (taste.interests.length === 0 && taste.accessPrefs.length === 0) return [];
  const gone = new Set(dismissed);
  const soon = events.filter((event) => {
    if (!event.starts_at) return false;
    const at = new Date(event.starts_at).getTime();
    return at >= now && at <= now + WEEK_MS && matchScore(event, taste) > 0;
  });
  return oneCardPerProgram(personalizedFeed(soon, taste))
    .filter((event) => !gone.has(programKey(event)))
    .slice(0, RECOMMENDED_MAX);
}
