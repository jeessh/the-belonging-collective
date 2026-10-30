import {
  Apple,
  Bike,
  BookOpen,
  Coffee,
  CookingPot,
  Dumbbell,
  Gamepad2,
  Handshake,
  Headphones,
  HeartHandshake,
  Palette,
  PartyPopper,
  Sprout,
  Ticket,
  Trophy,
  Backpack,
  Leaf,
  type LucideIcon,
} from "lucide-react";
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
export type CategoryStyle = { icon: LucideIcon; color: string };

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
 * The label for a stored slug, from `list`. Falls back to prettifying the
 * slug, so a value not in the list — the archived demo programming's
 * "Advice", a topic read before the list has loaded — still renders as words
 * rather than vanishing. Components reach this through `useCategories().label`,
 * which is what re-renders them once the list is in; plain functions
 * (dimensions.ts) read the cache and rely on their caller holding the hook.
 */
export function categoryLabel(
  slug?: string | null,
  list: Category[] | null = cache,
): string {
  if (!slug) return "";
  const hit = list?.find((c) => c.slug === slug);
  if (hit) return hit.label;
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** Shown for a program with no topic. Not a topic anyone can be interested in. */
export const FALLBACK_CATEGORY = "General";
const FALLBACK_STYLE: CategoryStyle = { icon: Ticket, color: "#5B5BD6" };

// Icon (Lucide, the app's one icon set) and colour per slug, for the chips.
// Keyed by slug so a rename keeps its look; a topic added in the console gets
// a stable hashed colour and the fallback icon. The legacy hackathon slugs keep theirs so the
// archived demo programming still reads the same.
const STYLES: Record<string, CategoryStyle> = {
  education: { icon: BookOpen, color: "#4C6EE8" },
  social: { icon: PartyPopper, color: "#E86A4C" },
  recreation: { icon: Bike, color: "#3AA0C2" },
  "support-group": { icon: Handshake, color: "#2FA36B" },
  cooking: { icon: CookingPot, color: "#E8318A" },
  fundraising: { icon: HeartHandshake, color: "#E8A33D" },
  "youth-programs": { icon: Backpack, color: "#9B5BD6" },
  wellness: { icon: Leaf, color: "#2F8F5B" },
  fitness: { icon: Dumbbell, color: "#F59E0B" },
  "arts-crafts": { icon: Palette, color: "#E84C88" },
  music: { icon: Headphones, color: "#6366F1" },
  games: { icon: Gamepad2, color: "#3B82F6" },
  sports: { icon: Trophy, color: "#22C55E" },
  hangout: { icon: Coffee, color: "#22C55E" },
  food: { icon: Apple, color: "#E8318A" },
  advice: { icon: Sprout, color: "#2FA36B" },
  arts: { icon: Palette, color: "#F59E0B" },
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
  return { icon: FALLBACK_STYLE.icon, color: PALETTE[h % PALETTE.length] };
}
