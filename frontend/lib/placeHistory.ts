"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * The member feed is one page, but members (and staff showing them) press
 * the browser's Back button expecting to leave whatever they opened, not the
 * site (client feedback). So every place in the feed — card or list view,
 * the saved events page, an event's details, the sign-in sheet — is a
 * browser history entry with its own address:
 *
 *   /?view=list&saved=1&event=<id>&signin=1
 *
 * `go` is a member's own move (a new entry). Changes the member didn't make
 * as a move (the profile loading its preferred view, signing in) only update
 * the entry they're on. Closing something with its own ×/Back goes back in
 * history rather than adding an entry, so Back after closing a dialog
 * doesn't open it again.
 *
 * The sign-in sheet's steps add entries of their own on top (useStepHistory,
 * under `authDepth`), which closing the sheet steps back over too.
 */

export type Place = {
  mode: "card" | "list";
  saved: boolean;
  event: string | null;
  signin: boolean;
};

const KEY = "tbc";
const DEPTH = "tbcDepth";

function urlFor(p: Place): string {
  const u = new URL(window.location.href);
  for (const k of ["view", "saved", "event", "signin"]) u.searchParams.delete(k);
  if (p.mode === "list") u.searchParams.set("view", "list");
  if (p.saved) u.searchParams.set("saved", "1");
  if (p.event) u.searchParams.set("event", p.event);
  if (p.signin) u.searchParams.set("signin", "1");
  return u.pathname + u.search + u.hash;
}

/** Reads a place from the address — a reload or a shared link. */
export function placeFromUrl(): Partial<Place> {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  return {
    mode: q.get("view") === "list" ? "list" : q.get("view") === "card" ? "card" : undefined,
    saved: q.get("saved") === "1",
    event: q.get("event"),
  };
}

export function usePlaceHistory(current: Place, apply: (p: Place) => void) {
  const currentRef = useRef(current);
  currentRef.current = current;
  const applyRef = useRef(apply);
  applyRef.current = apply;

  // Whatever the feed shows is what the entry it's on says — kept up to
  // date for changes that aren't moves (the profile's view, signing in).
  useEffect(() => {
    const s = window.history.state ?? {};
    window.history.replaceState({ ...s, [KEY]: current }, "", urlFor(current));
  }, [current.mode, current.saved, current.event, current.signin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const p = e.state?.[KEY] as Place | undefined;
      if (p) applyRef.current(p);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** A member's move: a new history entry. */
  const go = useCallback((patch: Partial<Place>) => {
    const next = { ...currentRef.current, ...patch };
    const depth = (window.history.state?.[DEPTH] ?? 0) + 1;
    window.history.pushState({ [KEY]: next, [DEPTH]: depth }, "", urlFor(next));
    applyRef.current(next);
  }, []);

  /**
   * Close `what` the way Back would: step back to the entry before it was
   * opened when that's the entry behind this one, else just close it here.
   */
  const leave = useCallback((what: keyof Place, closed: Partial<Place>) => {
    const s = window.history.state ?? {};
    const here = s[KEY] as Place | undefined;
    const steps = what === "signin" ? 1 + (s.authDepth ?? 0) : 1;
    if (here?.[what] && (s[DEPTH] ?? 0) >= steps) {
      window.history.go(-steps);
    } else {
      applyRef.current({ ...currentRef.current, ...closed });
    }
  }, []);

  return { go, leave };
}

/**
 * A multi-step flow's steps as history entries (the sign-in / sign-up
 * steps), so Back returns to the step before. The flow's own Back buttons
 * step back through history too, when the step they go to is the one
 * behind. `locked` (once the account exists) stops stepping back into the
 * steps that made it: those changes update the entry instead.
 */
export function useStepHistory<T extends string>(
  step: T,
  setStep: (s: T) => void,
  locked = false,
) {
  const fromPop = useRef(false);
  const stepRef = useRef(step);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const trail = useRef<T[]>([]);

  // The first step is the entry the flow opened on.
  useEffect(() => {
    const s = window.history.state ?? {};
    window.history.replaceState({ ...s, authStep: step, authDepth: 0 }, "");
    trail.current = [step];
    return () => {
      trail.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stepRef.current === step) return;
    stepRef.current = step;
    if (fromPop.current) {
      fromPop.current = false;
      return;
    }
    const s = window.history.state ?? {};
    const depth: number = s.authDepth ?? 0;
    if (lockedRef.current) {
      window.history.replaceState({ ...s, authStep: step }, "");
      trail.current[depth] = step;
      return;
    }
    if (depth > 0 && trail.current[depth - 1] === step) {
      // The flow's own Back to the step behind: go there in history.
      fromPop.current = true;
      window.history.back();
      return;
    }
    window.history.pushState({ ...s, authStep: step, authDepth: depth + 1 }, "");
    trail.current = [...trail.current.slice(0, depth + 1), step];
  }, [step]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const target = e.state?.authStep as T | undefined;
      if (fromPop.current && target === stepRef.current) {
        fromPop.current = false;
        return;
      }
      if (!target || lockedRef.current || target === stepRef.current) return;
      fromPop.current = true;
      setStep(target);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setStep]);
}
