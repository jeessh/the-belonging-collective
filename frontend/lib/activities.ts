import {
  BookOpen,
  Bus,
  DoorOpen,
  Drama,
  Handshake,
  PartyPopper,
  Sprout,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * What kind of thing a program is, as distinct from what it's about.
 *
 * `CATEGORIES` is the topic — Cooking, Sports, Arts. This is the shape: whether
 * you'd be sitting in a class, dropping into a social, or going somewhere. Both
 * matter to "is this for me?", and neither answers the other: a cooking class
 * and a cooking drop-in are different commitments to the same subject.
 *
 * Same rule as categories — hosts pick from this list rather than typing, so a
 * value can never exist that no member's choice can match.
 *
 * This vocabulary is a starting point drawn from how the existing calendar
 * describes its programming. It is the sort of thing the agencies should
 * correct; changing a label here changes what hosts can pick.
 */
export type ActivityType = { label: string; icon: LucideIcon };

export const ACTIVITY_TYPES: ActivityType[] = [
  { label: "Class", icon: BookOpen },
  { label: "Workshop", icon: Wrench },
  { label: "Social", icon: PartyPopper },
  { label: "Drop-in", icon: DoorOpen },
  { label: "Outing", icon: Bus },
  { label: "Support group", icon: Handshake },
  { label: "Volunteering", icon: Sprout },
  { label: "Performance", icon: Drama },
];

/** Shown for a program whose host didn't pick a kind. */
export const FALLBACK_ACTIVITY = "Other";
