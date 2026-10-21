"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EventsView } from "@/components/EventsView";
import { FeedLoading } from "@/components/member/FeedLoading";
import { ApiError, api, fetchAllEvents, type Event, type Me } from "@/lib/api";

/**
 * The front door is the feed.
 *
 * There was a landing page here — a title, a tagline and a "See programs"
 * button. It asked everyone to press one more thing to reach the only thing the
 * site does, and for someone who finds navigation hard that is a whole extra
 * decision in front of the content. Signing in lives in the corner of the feed,
 * where it is needed, rather than being the price of admission.
 */
export default function HomePage() {
  // The feed is public. GET /events needs no cookie, so browsing here is open
  // to everyone — a link a nonprofit shares has to lead somewhere a stranger
  // can actually use. Signing in is what saving requires, not what looking
  // requires.
  const [eventsPromise] = useState<Promise<Event[]>>(() => {
    if (typeof window === "undefined") return Promise.resolve([]);
    const p = fetchAllEvents();
    p.catch(() => {});
    return p;
  });
  // Already-saved programs, so the badge and count survive a reload. 401s for a
  // signed-out visitor, which is not an error here — they simply have none.
  const [attendedPromise] = useState<Promise<Event[]>>(() => {
    if (typeof window === "undefined") return Promise.resolve([]);
    const p = api<Event[]>("/users/me/events").catch(() => [] as Event[]);
    return p;
  });

  // undefined = still resolving, null = signed out, Me = signed in. The three
  // are distinct: rendering the feed before we know would flash the signed-out
  // affordances at a member who is signed in.
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    api<Me>("/users/me")
      .then((res) => alive && setMe(res))
      .catch((e) => {
        if (!alive) return;
        // Only a real 401 means "signed out". A network blip or a 5xx must not
        // show a signed-in member the signed-out app — they'd find their saved
        // list gone and a Sign in button where their profile was.
        if (e instanceof ApiError && e.status === 401) setMe(null);
        else setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (failed) {
    return (
      <main className="grid h-dvh place-items-center bg-surface-subtle px-6 text-center text-fg">
        <div className="flex flex-col items-center gap-5">
          <p className="text-2xl font-medium">Couldn&apos;t reach the server.</p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </Button>
        </div>
      </main>
    );
  }

  if (me === undefined) return <FeedLoading />;

  return (
    <EventsView
      initialMe={me}
      eventsPromise={eventsPromise}
      attendedPromise={attendedPromise}
    />
  );
}
