import { Pill } from "@/components/AdminTable";

export type EventState = "draft" | "published" | "unpublished";

/**
 * Where an event stands, beside its title: Draft (being created — nothing is
 * saved or seen until Publish), Published (in the member feed) or
 * Un-published (taken off it, restorable). There is no saved-draft state on
 * the server yet; "Draft" is the create page.
 */
export function EventStatus({ state }: { state: EventState }) {
  const look = {
    draft: { tone: "neutral" as const, label: "Draft" },
    published: { tone: "good" as const, label: "Published" },
    unpublished: { tone: "warn" as const, label: "Un-published" },
  }[state];
  return <Pill tone={look.tone}>{look.label}</Pill>;
}
