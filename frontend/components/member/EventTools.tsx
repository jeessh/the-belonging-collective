"use client";

import { useState } from "react";
import { Printer, Send } from "lucide-react";
import type { Event } from "@/lib/api";
import { eventShareText, publicEventUrl } from "@/lib/share";
import { Button } from "@/components/ui/Button";
import { GoingCount } from "@/components/ui/GoingCount";
import { EventDetails } from "@/components/member/EventDetails";
import { ShareModal } from "@/components/member/ShareModal";
import { PrintPreview } from "@/components/member/PrintPreview";

/** Share and Print for one program — the dialog's and the page's top right. */
export function EventTools({ event }: { event: Event }) {
  const [open, setOpen] = useState<"share" | "print" | null>(null);
  const url = typeof window === "undefined" ? "" : publicEventUrl(event.id);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setOpen("share")} trailingIcon={<Send />}>
          Share
        </Button>
        <Button onClick={() => setOpen("print")} trailingIcon={<Printer />}>
          Print
        </Button>
      </div>

      {open === "share" && (
        <ShareModal
          title="Share this event?"
          subject={event.title}
          body={eventShareText(event, url)}
          copy={{ label: "Link", text: url }}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "print" && (
        <PrintPreview
          title={event.title}
          printLabel="Print Event"
          onClose={() => setOpen(null)}
        >
          <EventDetails
            event={event}
            titleAs="h3"
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
