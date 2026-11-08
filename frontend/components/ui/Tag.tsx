import type { ComponentType } from "react";
import { BookmarkCheck, Lock, Sparkles } from "lucide-react";
import type { Event } from "@/lib/api";
import { dimensionByKey } from "@/lib/dimensions";

export type TagKind =
  | "free"
  | "paid"
  | "dropin"
  | "signup"
  | "inperson"
  | "virtual"
  | "access"
  | "foryou"
  | "saved";

const TAG: Record<
  TagKind,
  { label: string; className: string; icon?: ComponentType<{ className?: string }> }
> = {
  free: { label: "Free", className: "bg-tag-free-bg text-tag-free-fg" },
  paid: { label: "Paid", className: "bg-tag-paid-bg text-tag-paid-fg" },
  dropin: {
    label: "Drop-in",
    className: "bg-tag-dropin-bg text-tag-dropin-fg",
  },
  signup: {
    label: "Registration required",
    // Neutral, not a colour of its own: green / blue mean free / paid, and
    // the one accent is the app's cyan.
    className: "border border-line bg-surface-subtle text-fg",
  },
  inperson: {
    label: "In-person",
    className: "bg-tag-inperson-bg text-tag-inperson-fg",
  },
  virtual: {
    label: "Virtual",
    className: "bg-tag-virtual-bg text-tag-virtual-fg",
  },
  // A program restricted to an organization's approved members.
  access: {
    label: "Special access",
    className: "bg-tag-access-bg text-tag-access-fg",
    icon: Lock,
  },
  // In this week's picks for the signed-in member.
  // Already on the member's saved list (or the list "Saving for" names).
  saved: {
    label: "Saved",
    // Neutral grey, like Registration required: a fact, not a call to act.
    className: "border border-line bg-surface-subtle text-fg",
    icon: BookmarkCheck,
  },
  foryou: {
    label: "For you",
    className: "border border-primary-border bg-primary-soft text-fg",
    icon: Sparkles,
  },
};

export function Tag({
  kind,
  detail,
  className = "",
}: {
  kind: TagKind;
  /** After the label where there is room — the access group's name. */
  detail?: string;
  className?: string;
}) {
  const { label, className: tone, icon: Icon } = TAG[kind];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-control px-3 py-1 text-lg font-medium leading-snug ${tone} ${className}`}
    >
      {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
      {label}
      {detail && (
        <span className="max-sm:sr-only">
          <span aria-hidden="true">· </span>
          {detail}
        </span>
      )}
    </span>
  );
}

/**
 * The pills a card shows beside its title: "Free" or "Paid" (from the
 * organizer's cost answer) and "Registration required" when it needs one
 * (nothing for a drop-in).
 * Paid, drop-in / sign-up and in-person / virtual are no longer tagged — the
 * card's facts and the event's page carry them, and the filters still sort
 * by them. Cost reads the feed's grouping bucket so the FREE pill and the
 * "Free" filter can never disagree.
 */
export function eventTags(event: Event): TagKind[] {
  const tags: TagKind[] = [];
  // Free or Paid, always one of the two, from the organizer's cost answer.
  tags.push(dimensionByKey("price").bucket(event).id === "free" ? "free" : "paid");
  // Only when registering is required; a drop-in says nothing.
  if (event.requires_signup) tags.push("signup");
  return tags;
}
