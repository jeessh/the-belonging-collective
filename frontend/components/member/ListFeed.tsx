"use client";

import { memo } from "react";
import { MoveRight, Sparkles, X } from "lucide-react";
import type { Event } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EventSummary } from "@/components/ui/EventSummary";
import { GoingCount } from "@/components/ui/GoingCount";

/**
 * Every program as a row, hairlines between. The same filters and sort as the
 * card view; the row is the shared summary plus one way in.
 *
 * `recommended` is this week's picks, shown as a section on top. A pick can be
 * dismissed from that section; the row it duplicates below stays, because
 * nothing personal ever hides a program from the feed.
 */
export const ListFeed = memo(function ListFeed({
  events,
  recommended = [],
  onOpen,
  onDismiss,
  onSignIn,
}: {
  events: Event[];
  recommended?: Event[];
  onOpen: (event: Event) => void;
  onDismiss?: (event: Event) => void;
  onSignIn: () => void;
}) {
  if (events.length === 0 && recommended.length === 0) {
    return (
      <p className="py-16 text-center text-2xl text-fg-muted">
        No events match these filters.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {recommended.length > 0 && (
        <section
          aria-labelledby="for-you-heading"
          className="rounded-card border-2 border-primary-border bg-primary-soft/40 p-4 sm:p-6"
        >
          <h2
            id="for-you-heading"
            data-tour="foryou"
            className="flex items-center gap-3 text-2xl font-medium text-fg"
          >
            <Sparkles aria-hidden="true" className="size-7 text-primary-border" />
            For you this week
          </h2>
          <ul className="mt-2 divide-y divide-line-card">
            {recommended.map((ev) => (
              <li key={ev.id} className="py-6">
                <EventSummary
                  event={ev}
                  layout="row"
                  going={<GoingCount count={ev.saved_count} onSignIn={onSignIn} />}
                  actions={
                    <>
                      {onDismiss && (
                        <Button
                          variant="ghost"
                          onClick={() => onDismiss(ev)}
                          aria-label={`Not for me: ${ev.title}`}
                          leadingIcon={<X />}
                        >
                          Not for me
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={() => onOpen(ev)}
                        trailingIcon={<MoveRight />}
                      >
                        More information
                      </Button>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length === 0 ? (
        <p className="py-16 text-center text-2xl text-fg-muted">
          No events match these filters.
        </p>
      ) : (
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
      )}
    </div>
  );
});
