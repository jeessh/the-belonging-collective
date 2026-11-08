"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import {
  apiMessage,
  decideWaitlist,
  fetchWaitlist,
  type WaitlistEntry,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EmptyRow, Pill, TableCard } from "@/components/AdminTable";
import { useToast } from "@/components/ui/Toast";

/**
 * An event's waitlist, on its details page (Waitlist tab): once the attendee
 * limit is reached, a member's save lands here. Approving makes it a save
 * (even past the limit — the organizer's call); declining keeps them out.
 * Either way the member is emailed. A declined member can still be approved.
 */
export function WaitlistPanel({
  eventId,
  capacity,
  going,
}: {
  eventId: string;
  capacity: number;
  going: number;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<WaitlistEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [count, setCount] = useState(going);

  const load = useCallback(() => {
    fetchWaitlist(eventId)
      .then(setRows)
      .catch((e) => {
        setRows([]);
        toast.show({ title: apiMessage(e, "Couldn't load the waitlist."), tone: "alert" });
      });
  }, [eventId, toast]);
  useEffect(load, [load]);

  async function decide(row: WaitlistEntry, approve: boolean) {
    setBusy(row.user_id);
    try {
      await decideWaitlist(eventId, row.user_id, approve);
      if (approve) {
        setRows((r) => (r ?? []).filter((x) => x.user_id !== row.user_id));
        setCount((n) => n + 1);
      } else {
        setRows((r) =>
          (r ?? []).map((x) => (x.user_id === row.user_id ? { ...x, status: "declined" } : x)),
        );
      }
      toast.show({
        title: approve ? `${row.name} is in` : `${row.name} was declined`,
        description: "They've been emailed.",
      });
    } catch (e) {
      toast.show({ title: apiMessage(e, "That didn't work. Please try again."), tone: "alert" });
    } finally {
      setBusy(null);
    }
  }

  const waiting = (rows ?? []).filter((r) => r.status === "waitlisted").length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-fg-muted">
        {count} of {capacity} places taken · {waiting} waiting. Approving lets
        someone in even when it&apos;s full.
      </p>
      <TableCard caption="Waitlist" head={["Name", "Email", "Asked", "Status", ""]}>
        {rows === null ? (
          <EmptyRow colSpan={5} text="Loading…" />
        ) : rows.length === 0 ? (
          <EmptyRow colSpan={5} text="Nobody is waiting." />
        ) : (
          rows.map((row) => (
            <tr key={row.user_id} className="border-t border-line">
              <td className="px-3 py-3 font-medium text-fg">{row.name}</td>
              <td className="px-3 py-3">{row.email ?? "—"}</td>
              <td className="px-3 py-3">
                {new Date(row.requested_at).toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                })}
              </td>
              <td className="px-3 py-3">
                {row.status === "waitlisted" ? (
                  <Pill tone="warn">Waiting</Pill>
                ) : (
                  <Pill>Declined</Pill>
                )}
              </td>
              <td className="px-3 py-3">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="primary"
                    disabled={busy === row.user_id}
                    onClick={() => void decide(row, true)}
                    leadingIcon={<Check />}
                  >
                    Approve
                  </Button>
                  {row.status === "waitlisted" && (
                    <Button
                      variant="danger"
                      disabled={busy === row.user_id}
                      onClick={() => void decide(row, false)}
                      leadingIcon={<X />}
                    >
                      Decline
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))
        )}
      </TableCard>
    </div>
  );
}
