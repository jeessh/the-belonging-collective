"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EventsView } from "@/components/EventsView";
import { FeedLoading } from "@/components/member/FeedLoading";
import {
  ApiError,
  api,
  fetchAllEvents,
  fetchOrgSpace,
  type Event,
  type Me,
  type OrgSpace,
} from "@/lib/api";

/**
 * One organization's own page: the same feed, holding only that
 * organization's programs. It is what an agency trying the platform gets —
 * their own space, empty until they post, without everyone else's programs
 * around it. Whether their programs also reach the shared feed at `/` is
 * `in_shared_feed`, chosen when they're onboarded.
 */
export default function OrgSpacePage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  // undefined = looking it up, null = no such organization.
  const [space, setSpace] = useState<OrgSpace | null | undefined>(undefined);
  useEffect(() => {
    fetchOrgSpace(slug)
      .then(setSpace)
      .catch(() => setSpace(null));
  }, [slug]);

  const [eventsPromise] = useState<Promise<Event[]>>(() => {
    if (typeof window === "undefined") return Promise.resolve([]);
    const p = fetchAllEvents(slug);
    p.catch(() => {});
    return p;
  });
  const [attendedPromise] = useState<Promise<Event[]>>(() => {
    if (typeof window === "undefined") return Promise.resolve([]);
    return api<Event[]>("/users/me/events").catch(() => [] as Event[]);
  });

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
        if (e instanceof ApiError && e.status === 401) setMe(null);
        else setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (space === null) {
    return (
      <main className="grid h-dvh place-items-center bg-surface-subtle px-6 text-center text-fg">
        <div className="flex flex-col items-center gap-5">
          <p className="text-2xl font-medium">This page doesn&apos;t exist.</p>
          <Link href="/" className="text-lg underline underline-offset-4">
            See all programs
          </Link>
        </div>
      </main>
    );
  }

  if (failed) {
    return (
      <main className="grid h-dvh place-items-center bg-surface-subtle px-6 text-center text-fg">
        <div className="flex flex-col items-center gap-5">
          <p className="text-2xl font-medium">Couldn&apos;t reach the server.</p>
          <Button variant="primary" size="lg" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      </main>
    );
  }

  if (me === undefined || space === undefined) return <FeedLoading />;

  return (
    <EventsView
      initialMe={me}
      eventsPromise={eventsPromise}
      attendedPromise={attendedPromise}
      space={space}
    />
  );
}
