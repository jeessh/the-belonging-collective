"use client";

import { useEffect, useState } from "react";

/**
 * Does the viewport match `query` right now? False on the server and on the
 * first client render, so markup that depends on it is desktop-first and
 * corrects after mount — the same render on both sides, no hydration gap.
 *
 * For things CSS can't do alone: swapping which component renders, or where
 * in the DOM it goes. Plain layout belongs in responsive classes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return matches;
}
