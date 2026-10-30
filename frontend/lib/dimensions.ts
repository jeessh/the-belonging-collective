import type { Event } from "@/lib/api";
import {
  FALLBACK_CATEGORY,
  categoryLabel,
  categoryStyle,
} from "@/lib/categories";

/**
 * How the feed is grouped — the "See events by" choice.
 *
 * Grouping never removes cards. Picking a dimension changes what the stepper
 * above the card shows and what jumping lands on; the underlying order is still
 * the personalized feed. That keeps the standing rule (personalization sorts,
 * it never filters) true for this control too.
 */
export type DimensionKey =
  | "org"
  | "price"
  | "registration"
  | "eventType"
  | "activityType";

export type Dimension = {
  key: DimensionKey;
  /** Short label, for the dropdown menu. */
  label: string;
  /** Long form, shown as the page heading. */
  heading: string;
  /** Which bucket an event belongs to. */
  bucket: (event: Event) => {
    id: string;
    label: string;
    color: string;
    /** Shown instead of initials when the bucket has one. */
    logoUrl?: string | null;
  };
  /**
   * Every bucket an event belongs to, for filtering, where it can be in more
   * than one (several topics; youth and virtual at once). Absent means just
   * `bucket`. `bucket` stays the one the stepper and tags group on.
   */
  all?: (event: Event) => ReturnType<Dimension["bucket"]>[];
};

/** Every bucket `event` is in on `dimension` — what a filter matches on. */
export const bucketsOf = (dimension: Dimension, event: Event) =>
  dimension.all ? dimension.all(event) : [dimension.bucket(event)];

/** Stable colour per bucket id, so a bucket keeps its colour across renders. */
const PALETTE = [
  "#E8318A",
  "#22C55E",
  "#9B5BD6",
  "#3B82F6",
  "#F59E0B",
  "#E86A4C",
  "#2FA36B",
];
// The same hues, deep enough for white initials on them (4.5:1 or better);
// the bright ones above read at 2.3:1 on an avatar.
const AVATAR_PALETTE = [
  "#B8216A",
  "#15803D",
  "#7C3AED",
  "#1D4ED8",
  "#B45309",
  "#C2410C",
  "#1F7A52",
];

function hashIndex(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}

export function hashColor(key: string): string {
  return PALETTE[hashIndex(key)];
}

/** `hashColor`'s hue, darkened to carry white text. */
export function avatarColor(key: string): string {
  return AVATAR_PALETTE[hashIndex(key)];
}

export const DIMENSIONS: Dimension[] = [
  {
    key: "org",
    label: "Non-Profit Org.",
    heading: "Non-Profit Organization",
    bucket: (e) => {
      const name = e.host_name || "Community";
      return {
        id: name,
        label: name,
        color: hashColor(name),
        logoUrl: e.host_logo_url ?? null,
      };
    },
  },
  {
    key: "price",
    label: "Cost",
    heading: "Cost",
    bucket: (e) =>
      e.is_free
        ? { id: "free", label: "Free", color: "#2FA36B" }
        : { id: "paid", label: "Paid", color: "#F59E0B" },
  },
  {
    key: "registration",
    label: "Registration Type",
    heading: "Registration Type",
    // The three states a member actually experiences. Whether sign-up is
    // internal or external only changes anything when sign-up is required, so
    // drop-in is one bucket rather than two.
    bucket: (e) => {
      if (!e.requires_signup) {
        return { id: "dropin", label: "Drop in", color: "#22C55E" };
      }
      return e.registration_mode === "external"
        ? {
            id: "external",
            label: "Registration (link given)",
            color: "#3B82F6",
          }
        : {
            id: "internal",
            label: "Registration (no link)",
            color: "#9B5BD6",
          };
    },
  },
  {
    key: "eventType",
    label: "Event Type",
    heading: "Event Type",
    // Virtual, in person, or for youth — the same three the admin filters on.
    bucket: (e) => (e.is_youth ? YOUTH : venueOf(e)),
    // The form asks venue and audience separately, so a virtual youth
    // program is in both "Virtual" and "Youth".
    all: (e) => (e.is_youth ? [venueOf(e), YOUTH] : [venueOf(e)]),
  },
  {
    key: "activityType",
    label: "Activity Type",
    heading: "Activity Type",
    // The topic list. "Activity Type" is what the design calls it, and it is
    // what members pick as interests, so the feed groups on the same field the
    // matching runs on.
    bucket: (e) => topicBucket(e.category || ""),
    // A program can carry several topics; it's under each of them.
    all: (e) =>
      (e.categories?.length ? e.categories : [e.category || ""]).map(topicBucket),
  },
];

const YOUTH = { id: "youth", label: "Youth", color: "#F59E0B" };

const venueOf = (e: Event) =>
  e.is_virtual
    ? { id: "virtual", label: "Virtual", color: "#3B82F6" }
    : { id: "inperson", label: "In person", color: "#2FA36B" };

function topicBucket(slug: string) {
  // The bucket is the slug; the label is looked up, so a renamed topic
  // regroups nothing. Callers hold `useCategories()` so this re-runs once the
  // list has loaded.
  const style = categoryStyle(slug);
  return {
    id: slug || FALLBACK_CATEGORY,
    label: slug ? categoryLabel(slug) : FALLBACK_CATEGORY,
    color: style.color,
  };
}

export const dimensionByKey = (key: DimensionKey): Dimension =>
  DIMENSIONS.find((d) => d.key === key) ?? DIMENSIONS[0];

export type Bucket = {
  id: string;
  label: string;
  color: string;
  logoUrl?: string | null;
  /** Index in the feed of this bucket's first event — what jumping lands on. */
  index: number;
};

/** Buckets in first-appearance order, so the stepper reads left to right. */
export function bucketsFor(events: Event[], dimension: Dimension): Bucket[] {
  const seen = new Map<string, Bucket>();
  events.forEach((event, index) => {
    for (const b of bucketsOf(dimension, event)) {
      if (!seen.has(b.id)) seen.set(b.id, { ...b, index });
    }
  });
  return [...seen.values()];
}

/**
 * The feed reordered so each bucket's programs sit together, in the order the
 * stepper lays them out.
 *
 * The stepper draws a route across the top of the one-at-a-time view, so Next
 * has to walk it: finish this organization, then move to the next dot. Ordered
 * by date alone the buckets interleave, and stepping forward threw the active
 * dot back and forth across the rail — a progress indicator that doesn't
 * progress.
 *
 * Bucket order is still first appearance in the incoming order, so the
 * best-matching bucket leads, and inside a bucket the programs keep their
 * personalized-then-chronological order. Grouping reorders; like every other
 * ordering rule here it hides nothing.
 */
export function groupByBucket(events: Event[], dimension: Dimension): Event[] {
  const rank = new Map<string, number>();
  return events
    .map((event, index) => {
      const { id } = dimension.bucket(event);
      if (!rank.has(id)) rank.set(id, rank.size);
      return { event, index, rank: rank.get(id) as number };
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.event);
}
