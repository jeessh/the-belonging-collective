"use client";

import { DialRoot } from "dialkit";
import "dialkit/styles.css";

/**
 * DialKit's live tuning panel (bottom left). Hidden in production by
 * DialKit's own default, so only `npm run dev` shows it; the panels
 * themselves are registered where the animation lives (EventsView's
 * "Card transition").
 */
export function DevDials() {
  return <DialRoot position="bottom-left" />;
}
