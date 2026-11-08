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
}: {
  event: Event;
  /** Once the event is saved, Share and Print lead (primary, secondary)
      and Un-save drops to tertiary; otherwise they are quiet ghosts. */
  lead?: boolean;
}) {
  const [open, setOpen] = useState<"share" | "print" | null>(null);
  const url = typeof window === "undefined" ? "" : publicEventUrl(event.id);

  return (
    <>
      <div className={`flex flex-wrap ${lead ? "gap-3" : "gap-1"}`}>
        <Button
          variant={lead ? "primary" : "ghost"}
          size={lead ? "lg" : "md"}
          onClick={() => setOpen("share")}
          trailingIcon={<Send />}
        >
          Share
        </Button>
        <Button
          variant={lead ? "secondary" : "ghost"}
          size={lead ? "lg" : "md"}
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
                <GoingCount count={event.saved_count} />
              ) : undefined
            }
          />
        </PrintPreview>
      )}
    </>
  );
}
