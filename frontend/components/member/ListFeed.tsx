"use client";

import { memo } from "react";
import { MoveRight } from "lucide-react";
import type { Event } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EventSummary } from "@/components/ui/EventSummary";
import { GoingCount } from "@/components/ui/GoingCount";

/**
 * Every program as a row, hairlines between. The same filters and sort as the
 * card view; the row is the shared summary plus one way in.
 */
export const ListFeed = memo(function ListFeed({
  events,
  onOpen,
  onSignIn,
}: {
  events: Event[];
  onOpen: (event: Event) => void;
  onSignIn: () => void;
}) {
  if (events.length === 0) {
    return (
      <p className="py-16 text-center text-2xl text-fg-muted">
        No events match these filters.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line-card border-y border-line-card">
      {events.map((ev) => (
        <li key={ev.id} className="py-6">
          <EventSummary
            event={ev}
            layout="row"
            going={<GoingCount count={ev.saved_count} onSignIn={onSignIn} />}
            actions={
              <Button
                variant="secondary"
                size="lg"
                onClick={() => onOpen(ev)}
                trailingIcon={<MoveRight />}
              >
                More information
              </Button>
            }
          />
        </li>
      ))}
    </ul>
  );
});
