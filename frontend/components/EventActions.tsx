"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkCheck, ExternalLink, MapPin } from "lucide-react";
import { ApiError, api, type Event } from "@/lib/api";
import { mapsUrl } from "@/lib/share";
import { Button, buttonClass } from "@/components/ui/Button";

/**
 * The public page's bottom row: the map, Save, and — when registration lives
 * on the organizer's own site — Register, which counts the click. Saving needs
 * an account; following a link never does.
 */
export function EventActions({ event }: { event: Event }) {
  const router = useRouter();
  const params = useSearchParams();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const external =
    event.requires_signup &&
    event.registration_mode === "external" &&
    !!event.registration_url;
  const maps = mapsUrl(event.location);

  const save = useCallback(
    async (resuming = false) => {
      setBusy(true);
      setError(null);
      try {
        await api(`/events/${event.id}/attend`, { method: "POST" });
        setSaved(true);
      } catch (e) {
        // Not signed in: keep where they were and what they wanted, so coming
        // back doesn't mean finding the program again and pressing twice.
        // While resuming they have just signed in, so a 401 means the cookie
        // didn't take — say so rather than bouncing them round the loop again.
        if (e instanceof ApiError && e.status === 401 && !resuming) {
          const next = encodeURIComponent(`/events/${event.id}?save=1`);
          router.push(`/signup?next=${next}`);
          return;
        }
        setError("That didn't save. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [event.id, router],
  );

  // Returning from sign-in with the save still pending. Runs once; a signed-out
  // visitor who lands here with the flag simply gets nothing.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || params.get("save") !== "1") return;
    resumed.current = true;
    void save(true);
    router.replace(`/events/${event.id}`);
  }, [params, save, router, event.id]);

  function openRegistration() {
    // Open synchronously, inside the click. Awaiting the tracking call first
    // crosses a microtask boundary, which Safari treats as the end of the user
    // gesture — the popup then gets blocked and the member goes nowhere.
    window.open(event.registration_url!, "_blank", "noopener,noreferrer");
    // Fire-and-forget: the count is ours to lose, not theirs.
    void api(`/events/${event.id}/registration-click`, {
      method: "POST",
    }).catch(() => {});
  }

  return (
    <>
      {maps && (
        <a
          href={maps}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("secondary", "lg")}
        >
          Google Maps
          <MapPin aria-hidden="true" className="size-6 shrink-0" />
        </a>
      )}
      <Button
        variant={external || saved ? "secondary" : "primary"}
        size="lg"
        onClick={() => void save()}
        disabled={busy || saved}
        trailingIcon={saved ? <BookmarkCheck /> : <Bookmark />}
      >
        {saved ? "Event saved" : "Save event"}
      </Button>
      {external && (
        <Button
          variant="primary"
          size="lg"
          onClick={openRegistration}
          trailingIcon={<ExternalLink />}
        >
          Register for Event
        </Button>
      )}
      {error && (
        <p role="alert" className="basis-full text-center text-lg text-danger-fg">
          {error}
        </p>
      )}
    </>
  );
}
