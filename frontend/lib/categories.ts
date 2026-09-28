import { api, type CategoryRow } from "@/lib/api";

/**
 * A topic. The slug is the identity — it is what `events.categories`,
 * `events.category` and `users.interest_categories` store, and what matching
 * compares — and the label is display-only, renamable by a superadmin in the
 * console's Topics page. `GET /categories` is the one list; the signup chips,
 * the feed's filter chips and the host's Activity Type picker all read it, so
 * a topic typed by hand can never match anyone.
 */
export type Category = CategoryRow;
export type CategoryStyle = { emoji: string; color: string };

// The list is fetched once per page load and shared by every caller. It is
// module state rather than context so plain functions (dimensions.ts) can read
// it too; `useCategories` (lib/useCategories.ts) re-renders its callers when
// it lands. No hooks in this file — server components import it.
let cache: Category[] | null = null;
let inflight: Promise<Category[]> | null = null;
const listeners = new Set<() => void>();

export function loadCategories(): Promise<Category[]> {
  if (cache) return Promise.resolve(cache);
  inflight ??= api<Category[]>("/categories")
    .then((rows) => {
      cache = rows;
      listeners.forEach((fn) => fn());
      return rows;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Drop the cached list so the next read refetches — after a console edit. */
export function invalidateCategories(): void {
  cache = null;
  listeners.forEach((fn) => fn());
}

export function subscribeCategories(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** What's cached right now, without fetching. */
export const peekCategories = (): Category[] | null => cache;

/**
 * The label for a stored slug. Falls back to prettifying the slug, so a value
 * not in the list — the archived demo programming's "Advice", a topic read
 * before the list has loaded — still renders as words rather than vanishing.
 */
export function categoryLabel(slug?: string | null): string {
  if (!slug) return "";
  const hit = cache?.find((c) => c.slug === slug);
  if (hit) return hit.label;
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** Shown for a program with no topic. Not a topic anyone can be interested in. */
export const FALLBACK_CATEGORY = "General";
const FALLBACK_STYLE: CategoryStyle = { emoji: "🎟️", color: "#5B5BD6" };

// Emoji and colour per slug, for the chips and the stepper. Keyed by slug so a
// rename keeps its look; a topic added in the console gets a stable hashed
// colour and the fallback glyph. The legacy hackathon slugs keep theirs so the
// archived demo programming still reads the same.
const STYLES: Record<string, CategoryStyle> = {
  education: { emoji: "📚", color: "#4C6EE8" },
  social: { emoji: "🎉", color: "#E86A4C" },
  recreation: { emoji: "🎳", color: "#3AA0C2" },
  "support-group": { emoji: "🤝", color: "#2FA36B" },
  cooking: { emoji: "🍳", color: "#E8318A" },
  fundraising: { emoji: "💛", color: "#E8A33D" },
  "youth-programs": { emoji: "🧒", color: "#9B5BD6" },
  wellness: { emoji: "🌿", color: "#2F8F5B" },
  fitness: { emoji: "🏃", color: "#F59E0B" },
  "arts-crafts": { emoji: "🎨", color: "#E84C88" },
  music: { emoji: "🎧", color: "#6366F1" },
  games: { emoji: "🎮", color: "#3B82F6" },
  sports: { emoji: "🏐", color: "#22C55E" },
  hangout: { emoji: "☕", color: "#22C55E" },
  food: { emoji: "🍌", color: "#E8318A" },
  advice: { emoji: "🌱", color: "#2FA36B" },
  arts: { emoji: "🎨", color: "#F59E0B" },
};

// Stable fallback palette for unknown slugs (hashed → same colour always).
const PALETTE = [
  "#E84C88",
  "#3AA0C2",
  "#E8A33D",
  "#5B5BD6",
  "#2FA36B",
  "#9B5BD6",
  "#E86A4C",
];

export function categoryStyle(slug?: string | null): CategoryStyle {
  const k = (slug ?? "").trim().toLowerCase();
  if (!k) return FALLBACK_STYLE;
  const known = STYLES[k];
  if (known) return known;
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return { emoji: FALLBACK_STYLE.emoji, color: PALETTE[h % PALETTE.length] };
}
