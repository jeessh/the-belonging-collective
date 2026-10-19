"use client";

import { useEffect, useState } from "react";
import { api, type Event } from "@/lib/api";
import { GoingCount } from "@/components/ui/GoingCount";

/**
 * "N going" on the server-rendered program page. The page is rendered
 * without the viewer's cookie, so it always has the anonymous null; a
 * signed-in member gets the real number here instead of an offer to log in.
 */
export function LiveGoingCount({
  eventId,
  signInHref,
}: {
  eventId: string;
  signInHref: string;
}) {
  const [count, setCount] = useState<number | null | undefined>(null);
  useEffect(() => {
    let alive = true;
    api<Event>(`/events/${eventId}`)
      .then((fresh) => {
        if (alive) setCount(fresh.saved_count);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [eventId]);
  return <GoingCount count={count} signInHref={signInHref} />;
}
