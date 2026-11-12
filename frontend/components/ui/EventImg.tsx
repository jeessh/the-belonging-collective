"use client";

import type { Event } from "@/lib/api";
import { eventImage } from "@/lib/eventImage";
import { useTrimmedSrc } from "@/lib/trimBorder";

/** An event's picture (`eventImage`), with any frame baked into the file cut
    off so it fills its box (lib/trimBorder). Decorative: `alt=""`. */
export function EventImg({ event, className }: { event: Event; className?: string }) {
  const src = useTrimmedSrc(eventImage(event));
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" draggable={false} className={className} />;
}
