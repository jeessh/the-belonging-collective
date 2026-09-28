import type { Event } from "@/lib/api";

/** Shown wherever a program has no picture of its own. */
export const EVENT_PLACEHOLDER = "/event-placeholder.jpg";

/**
 * The program's picture: its cover, else its first image, else the
 * placeholder. The fallback is display-only, so the organizer's form still
 * shows no image and asks for one.
 */
export function eventImage(event: Event): string {
  return event.cover_image_url ?? event.images[0]?.url ?? EVENT_PLACEHOLDER;
}
