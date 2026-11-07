import type { ComponentType } from "react";
import { Lock, Sparkles } from "lucide-react";
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
  | "foryou";

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
    label: "Sign-up",
    className: "bg-tag-signup-bg text-tag-signup-fg",
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
      className={`inline-flex items-center gap-2 rounded-control px-3 py-1 text-base uppercase tracking-wide ${tone} ${className}`}
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
 * The pills a card shows beside its title: just "Free", for a free program.
 * Paid, drop-in / sign-up and in-person / virtual are no longer tagged — the
 * card's facts and the event's page carry them, and the filters still sort
 * by them. Cost reads the feed's grouping bucket so the FREE pill and the
 * "Free" filter can never disagree.
 */
export function eventTags(event: Event): TagKind[] {
  return dimensionByKey("price").bucket(event).id === "free" ? ["free"] : [];
}
