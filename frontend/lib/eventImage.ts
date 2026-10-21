import type { Event } from "@/lib/api";

const PLACEHOLDERS = "/placeholders";

/** Shown where nothing more specific fits. */
export const EVENT_PLACEHOLDER = `${PLACEHOLDERS}/other.jpg`;

// Checked before the topic: a coffee morning looks like coffee whatever it's
// filed under.
const BY_TITLE: [RegExp, string][] = [
  [/\bcoffee\b/i, "coffee.jpg"],
  [/\bkaraoke\b/i, "music.jpg"],
  [/\bgolf\b/i, "sports.jpg"],
  [/\b(farm|garden|hik(e|ing)|walk(s|ing)?)\b/i, "outdoors.jpg"],
];

// Keyed by topic slug, like the emoji and colours in lib/categories.ts, so a
// rename keeps its picture. Several per topic where we have them: with one,
// a run of programs on the same topic showed the same photo card after card.
// A topic missing here gets EVENT_PLACEHOLDER.
const BY_TOPIC: Record<string, string[]> = {
  "arts-crafts": ["art.jpg", "community-craft.jpg"],
  cooking: ["cooking-together.jpg", "cooking-prep.jpg"],
  education: ["workshop.jpg", "workshop-table.jpg"],
  fitness: ["yoga.jpg"],
  games: ["games.jpg"],
  music: ["music.jpg"],
  social: ["shared-meal.jpg", "together.jpg"],
  sports: ["sports.jpg"],
  "support-group": ["together.jpg", "workshop-table.jpg"],
  wellness: ["yoga.jpg"],
  "youth-programs": ["story-time.jpg"],
  // The archived demo programming's topics.
  food: ["cooking-together.jpg", "cooking-prep.jpg"],
  hangout: ["shared-meal.jpg", "coffee.jpg"],
  advice: ["workshop-table.jpg", "together.jpg"],
  arts: ["art.jpg", "community-craft.jpg"],
};

/** The same program always gets the same one of a topic's pictures. */
function pick(files: string[], key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return files[Math.abs(hash) % files.length];
}

/**
 * The program's picture: its cover, else its first image, else a stock photo
 * picked by title, then by topic. The fallback is display-only, so the
 * organizer's form still shows no image and asks for one.
 */
export function eventImage(event: Event): string {
  const own = event.cover_image_url ?? event.images[0]?.url;
  if (own) return own;
  const byTitle = BY_TITLE.find(([pattern]) => pattern.test(event.title));
  const topics = event.categories?.length
    ? event.categories
    : event.category
      ? [event.category]
      : [];
  const choices = topics.map((slug) => BY_TOPIC[slug]).find(Boolean);
  const file = byTitle?.[1] ?? (choices && pick(choices, event.id));
  return file ? `${PLACEHOLDERS}/${file}` : EVENT_PLACEHOLDER;
}
