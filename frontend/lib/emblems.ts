/**
 * Profile-picture emblems — mirrors EMBLEMS in core/avatars.py.
 *
 * None of these is a sign-in icon (lib/icons.ts). The icons are the password,
 * so a picture shown beside a member's name must never be a hint to it.
 */
export const EMBLEMS = [
  { slug: "rainbow", emoji: "🌈", label: "Rainbow" },
  { slug: "leaf", emoji: "🍃", label: "Leaf" },
  { slug: "bird", emoji: "🐦", label: "Bird" },
  { slug: "mountain", emoji: "⛰️", label: "Mountain" },
  { slug: "wave", emoji: "🌊", label: "Wave" },
  { slug: "butterfly", emoji: "🦋", label: "Butterfly" },
  { slug: "music", emoji: "🎵", label: "Music" },
  { slug: "paint", emoji: "🎨", label: "Paint" },
] as const;

export function emblemEmoji(slug?: string | null): string | null {
  return EMBLEMS.find((e) => e.slug === slug)?.emoji ?? null;
}
