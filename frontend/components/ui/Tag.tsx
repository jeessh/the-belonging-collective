import type { Event } from "@/lib/api";
import { dimensionByKey } from "@/lib/dimensions";

export type TagKind =
  | "free"
  | "paid"
  | "dropin"
  | "signup"
  | "inperson"
  | "virtual";

const TAG: Record<TagKind, { label: string; className: string }> = {
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
};

export function Tag({
  kind,
  className = "",
}: {
  kind: TagKind;
  className?: string;
}) {
  const { label, className: tone } = TAG[kind];
  return (
    <span
      className={`inline-flex items-center rounded-control px-3 py-1 text-base uppercase tracking-wide ${tone} ${className}`}
    >
      {label}
    </span>
  );
}

/**
 * The three pills every card shows, in the design's order: cost, then
 * registration, then venue. Cost and registration come from the feed's
 * grouping buckets so a FREE pill and the "Free" filter can never disagree;
 * venue reads `is_virtual` directly because that bucket folds youth in.
 */
export function eventTags(event: Event): TagKind[] {
  const price = dimensionByKey("price").bucket(event).id;
  const registration = dimensionByKey("registration").bucket(event).id;
  return [
    price === "free" ? "free" : "paid",
    registration === "dropin" ? "dropin" : "signup",
    event.is_virtual ? "virtual" : "inperson",
  ];
}
