import {
  Bird,
  Flower2,
  Leaf,
  Mountain,
  Music,
  Palette,
  Rainbow,
  Waves,
  type LucideIcon,
} from "lucide-react";

/**
 * Profile-picture emblems — mirrors EMBLEMS in core/avatars.py.
 *
 * Purely decorative — nothing about sign-in.
 */
export const EMBLEMS: { slug: string; icon: LucideIcon; label: string }[] = [
  { slug: "rainbow", icon: Rainbow, label: "Rainbow" },
  { slug: "leaf", icon: Leaf, label: "Leaf" },
  { slug: "bird", icon: Bird, label: "Bird" },
  { slug: "mountain", icon: Mountain, label: "Mountain" },
  { slug: "wave", icon: Waves, label: "Wave" },
  // The slug stays "butterfly" (it's what's stored); Lucide has no butterfly.
  { slug: "butterfly", icon: Flower2, label: "Flower" },
  { slug: "music", icon: Music, label: "Music" },
  { slug: "paint", icon: Palette, label: "Paint" },
];

export function emblemIcon(slug?: string | null): LucideIcon | null {
  return EMBLEMS.find((e) => e.slug === slug)?.icon ?? null;
}
