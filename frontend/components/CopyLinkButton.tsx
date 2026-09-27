"use client";

import { Share2 } from "lucide-react";
import { Button, type ButtonSize } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/** The public URL of a program, read in the browser so a preview deployment
    copies its own address rather than production's. */
export function eventUrl(eventId: string): string {
  return `${window.location.origin}/events/${eventId}`;
}

/**
 * Copies a program's public URL. This is the point of the whole public event
 * page for an organizer: advertising is the job they described as exhausting,
 * and a link they can paste into a social post or an email is the thing the old
 * calendar never gave them.
 */
export function CopyLinkButton({
  eventId,
  title,
  label = "Share",
  iconOnly = false,
  size,
}: {
  eventId: string;
  /** Program name, so the toast and accessible name say which link. */
  title: string;
  label?: string;
  iconOnly?: boolean;
  size?: ButtonSize;
}) {
  const { show } = useToast();

  async function copy() {
    const url = eventUrl(eventId);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard access can be refused (permissions, insecure origin). The
      // prompt keeps the URL reachable — it can still be selected and copied.
      window.prompt("Copy this link:", url);
      return;
    }
    show({
      title: `Link to '${title}' copied.`,
      description: "Paste it wherever you're sharing.",
    });
  }

  return (
    <Button
      size={size}
      onClick={() => void copy()}
      aria-label={iconOnly ? `${label} ${title}` : undefined}
      title={iconOnly ? `${label} — copy link` : undefined}
      leadingIcon={<Share2 />}
    >
      {!iconOnly && label}
    </Button>
  );
}
