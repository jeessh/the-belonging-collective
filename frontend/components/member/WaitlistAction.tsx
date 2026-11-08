"use client";

import { Hourglass, Users } from "lucide-react";
import type { Event } from "@/lib/api";
import { Button } from "@/components/ui/Button";

/**
 * Stands in for Save / Register once a program's attendee limit is reached
 * (`is_full`), or while the member is waiting on it: "Join waitlist", then
 * "Leave waitlist"; declined, a disabled "Not able to join". Returns null
 * when the usual Save / Register applies — the caller draws those.
 */
export function waitlistState(event: Event): "join" | "waiting" | "declined" | null {
  if (event.viewer_status === "waitlisted") return "waiting";
  if (event.viewer_status === "declined") return "declined";
  if (event.is_full && event.viewer_status !== "saved") return "join";
  return null;
}

export function WaitlistAction({
  event,
  onJoin,
  onLeave,
  className = "",
  size = "lg",
  onPointerDown,
}: {
  event: Event;
  onJoin: () => void;
  onLeave: () => void;
  className?: string;
  size?: "md" | "lg";
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const state = waitlistState(event);
  if (state === "join")
    return (
      <Button
        variant="primary"
        size={size}
        className={className}
        onClick={onJoin}
        onPointerDown={onPointerDown}
        trailingIcon={<Users />}
        aria-label={`${event.title} is full. Join the waitlist`}
      >
        Join waitlist
      </Button>
    );
  if (state === "waiting")
    return (
      <Button
        size={size}
        className={className}
        onClick={onLeave}
        onPointerDown={onPointerDown}
        trailingIcon={<Hourglass />}
        aria-label={`On the waitlist for ${event.title}. Leave the waitlist`}
      >
        Leave waitlist
      </Button>
    );
  if (state === "declined")
    return (
      <Button size={size} className={className} disabled>
        Not able to join
      </Button>
    );
  return null;
}
