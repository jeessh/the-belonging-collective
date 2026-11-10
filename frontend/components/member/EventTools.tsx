"use client";

import { useState } from "react";
import { Printer, Send } from "lucide-react";
import type { Event } from "@/lib/api";
import { publicEventUrl } from "@/lib/share";
import { Button } from "@/components/ui/Button";
import { GoingCount } from "@/components/ui/GoingCount";
import { EventDetails } from "@/components/member/EventDetails";
import { ShareModal } from "@/components/member/ShareModal";
import { PrintPreview } from "@/components/member/PrintPreview";

/** Share and Print for one program (no per-event calendar button: saving
    syncs the member's calendar) — the dialog's and the page's bottom right. */
export function EventTools({
  event,
  lead = false,
  printLeads = false,
}: {
  event: Event;
  /** A shared list's dialog, where nothing can be saved: Print is the
      primary button at the very right, Share secondary beside it. */
  printLeads?: boolean;
  /** Once the event is saved, Share and Print lead (primary, secondary)
      and Un-save drops to tertiary; otherwise they are quiet ghosts. */
  lead?: boolean;
}) {
  const [open, setOpen] = useState<"share" | "print" | null>(null);
  const big = lead || printLeads;
  const url = typeof window === "undefined" ? "" : publicEventUrl(event.id);

  return (
    <>
      {/* Saved (`lead`): Print, then Share at the very right, each its own
          width. Otherwise two quiet ghosts. */}
      <div
        className={`flex ${big ? "w-full flex-row-reverse gap-3" : "flex-wrap gap-1"} ${
          printLeads ? "[&>*:first-child]:order-2" : ""
        }`}
      >
        <Button
          variant={lead ? "primary" : printLeads ? "secondary" : "ghost"}
          // Save Event's size, ghost or not.
          size="lg"
          onClick={() => setOpen("share")}
          trailingIcon={<Send />}
        >
          Share
        </Button>
        <Button
          variant={printLeads ? "primary" : lead ? "secondary" : "ghost"}
          // Save Event's size, ghost or not.
          size="lg"
          className={printLeads ? "order-1" : ""}
          onClick={() => setOpen("print")}
          trailingIcon={<Printer />}
        >
          Print
        </Button>
      </div>

      {open === "share" && (
        <ShareModal
          title="Share this event?"
          eventIds={[event.id]}
          link={{ getUrl: async () => url }}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "print" && (
        <PrintPreview
          title={event.title}
          printLabel="Print Event"
          titleOnPaper={false}
          onClose={() => setOpen(null)}
        >
          <EventDetails
            event={event}
            titleAs="h3"
            fixedDates
            // On paper only a number means anything; the anonymous
            // "See who else is going" has nothing to open.
            going={
              typeof event.saved_count === "number" ? (
                <GoingCount capacity={event.capacity} count={event.saved_count} />
              ) : undefined
            }
          />
        </PrintPreview>
      )}
    </>
  );
}
