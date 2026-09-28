import { Check, Lock, ShieldOff } from "lucide-react";
import type { AccessStatus, Event } from "@/lib/api";
import { Button } from "@/components/ui/Button";

/** Where this viewer stands with a restricted program; null for a public one. */
export type AccessState = AccessStatus | "none";

/**
 * A signed-out viewer has no membership row, and neither does a member who
 * never asked — both may ask.
 */
export function accessStateOf(event: Event): AccessState | null {
  if (!event.access_group) return null;
  return event.access_status ?? "none";
}

/**
 * The one control a restricted program shows in place of Save until the
 * organization has approved the member: ask, wait, or the answer was no.
 * Approved (or public) programs render nothing here and get Save instead.
 */
export function AccessAction({
  state,
  busy = false,
  onRequest,
}: {
  state: AccessState;
  busy?: boolean;
  onRequest: () => void;
}) {
  switch (state) {
    case "approved":
      return null;
    case "none":
      return (
        <Button
          variant="primary"
          size="lg"
          onClick={onRequest}
          disabled={busy}
          trailingIcon={<Lock />}
        >
          Request access
        </Button>
      );
    case "requested":
      return (
        <Button size="lg" disabled trailingIcon={<Check />}>
          Request sent
        </Button>
      );
    default:
      return (
        <p
          role="status"
          className="inline-flex min-h-14 items-center justify-center gap-3 rounded-control border border-line bg-surface-subtle px-6 py-3 text-xl text-fg-muted"
        >
          <ShieldOff aria-hidden="true" className="size-6 shrink-0" />
          Access not approved
        </p>
      );
  }
}
