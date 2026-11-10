"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkCheck, Printer, Search, Send } from "lucide-react";
import type { Event } from "@/lib/api";
import { oneCardPerProgram } from "@/lib/feed";
import { Button, buttonClass } from "@/components/ui/Button";
import { EventSummary } from "@/components/ui/EventSummary";
import { GoingCount } from "@/components/ui/GoingCount";
import { CaregiverFeed, byWhen } from "@/components/member/CaregiverFeed";
import { EventDetailModal } from "@/components/member/EventDetailModal";
import { ShareModal } from "@/components/member/ShareModal";
import { PrintPreview } from "@/components/member/PrintPreview";

/**
 * A member's shared list, for whoever has the link: the All Saved Events
 * page itself (components/SavedEvents.tsx), read-only. The same title and
 * count, search with Share and Print beside it, the same cards grouped This
 * week / This month / Next month / Later, each with Share and Print; a card
 * opens the same "More information" dialog. What the recipient can't do is
 * take anything off the list — there is no trash icon. Saving from the
 * dialog goes through sign-in, as it does on an event's own page.
 */
export function SharedListView({
  firstName,
  events,
}: {
  firstName: string;
  events: Event[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Event | null>(null);
  const [sub, setSub] = useState<"share" | "print" | null>(null);
  const shown = useMemo(() => oneCardPerProgram(events), [events]);
  const title = `${firstName}'s Saved Events`;

  // Saving, registering or asking for access is the visitor's own: sign in
  // (or up) and land on the event's page, which finishes the job.
  const viaSignIn = (ev: Event, intent: "save" | "access" = "save") =>
    router.push(`/signup?next=${encodeURIComponent(`/events/${ev.id}?${intent}=1`)}`);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* No "Back to events": the recipient didn't come from the feed. */}
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="flex items-center gap-3 text-3xl font-medium text-fg lg:text-[calc(2rem*var(--text-scale,1))]">
            <BookmarkCheck aria-hidden="true" className="size-8 shrink-0 text-fg-icon" />
            {title}
          </h1>
          <p className="text-xl text-fg-muted">
            {firstName} shared their list of events with you!
          </p>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 py-24 text-center">
          <p className="text-3xl font-medium text-fg">Nothing coming up on this list right now.</p>
          <a href="/" className={buttonClass("primary", "lg", "w-full")}>
            Browse Events
            <Search aria-hidden="true" className="size-6" />
          </a>
        </div>
      ) : (
        <CaregiverFeed
          events={shown}
          saved={new Set()}
          printIcon
          savedTag={false}
          group={byWhen}
          tools={
            <div className="flex gap-3">
              <Button
                size="lg"
                className="max-sm:flex-1"
                leadingIcon={<Send />}
                onClick={() => setSub("share")}
              >
                Share
              </Button>
              <Button
                size="lg"
                className="max-sm:flex-1"
                leadingIcon={<Printer />}
                onClick={() => setSub("print")}
              >
                Print
              </Button>
            </div>
          }
          onOpen={setOpen}
          onSave={viaSignIn}
          onUnsave={() => {}}
          onRegister={viaSignIn}
        />
      )}

      {open && (
        <EventDetailModal
          event={open}
          saved={false}
          onClose={() => setOpen(null)}
          onSave={viaSignIn}
          onUnsave={() => {}}
          onRegister={viaSignIn}
          onJoinWaitlist={viaSignIn}
          onLeaveWaitlist={() => {}}
          onRequestAccess={async (ev) => viaSignIn(ev, "access")}
          onSignIn={() => viaSignIn(open)}
          readOnly
        />
      )}

      {sub === "share" && (
        <ShareModal
          title="Share list of events?"
          eventIds={shown.map((ev) => ev.id)}
          link={{ getUrl: async () => window.location.href }}
          onClose={() => setSub(null)}
        />
      )}
      {sub === "print" && (
        <PrintPreview title={title} printLabel="Print List" onClose={() => setSub(null)}>
          <ul className="divide-y divide-line-card">
            {shown.map((ev) => (
              <li key={ev.id} className="py-6">
                <EventSummary
                  event={ev}
                  layout="row"
                  fixedDates
                  going={<GoingCount count={ev.saved_count} capacity={ev.capacity} />}
                />
              </li>
            ))}
          </ul>
        </PrintPreview>
      )}
    </div>
  );
}
