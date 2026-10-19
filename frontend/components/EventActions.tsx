"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";
import {
  ApiError,
  api,
  apiMessage,
  attendEvent,
  requestAccess,
  type Event,
} from "@/lib/api";
import { mapsUrl } from "@/lib/share";
import { clockTime } from "@/lib/time";
import { Button, buttonClass } from "@/components/ui/Button";
import {
  AccessAction,
  accessStateOf,
  type AccessState,
} from "@/components/member/AccessAction";
import { GoogleMapsIcon } from "@/components/ui/GoogleMapsIcon";
import { useToast } from "@/components/ui/Toast";

/**
 * The public page's bottom row: the map, Save, and — when registration lives
 * on the organizer's own site — Register, which counts the click. Saving needs
 * an account; following a link never does.
 *
 * A restricted program shows Request access instead of Save until the member
 * is approved. The page is rendered without the viewer's cookie, so their
 * standing is read here, in the browser, before that control settles.
 */
export function EventActions({ event }: { event: Event }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Null for a public program; "none" until the viewer's own read says
  // otherwise, which is also the right answer for a signed-out visitor.
  const [access, setAccess] = useState<AccessState | null>(() =>
    accessStateOf(event),
  );
  const [accessKnown, setAccessKnown] = useState(!event.access_group);

  useEffect(() => {
    if (!event.access_group) return;
    let alive = true;
    api<Event>(`/events/${event.id}`)
      .then((fresh) => {
        if (alive) setAccess(accessStateOf(fresh));
      })
      .catch(() => {})
      .finally(() => alive && setAccessKnown(true));
    return () => {
      alive = false;
    };
  }, [event.id, event.access_group]);

  // The page is rendered without the viewer's cookie, so it can't know they
  // already saved this. A signed-out visitor's 401 leaves Save as it is.
  useEffect(() => {
    let alive = true;
    api<Event[]>("/users/me/events")
      .then((mine) => {
        if (alive && mine.some((e) => e.id === event.id)) setSaved(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [event.id]);

  const external =
    event.requires_signup &&
    event.registration_mode === "external" &&
    !!event.registration_url;
  const maps = mapsUrl(event.location);

  // Not signed in: keep where they were and what they wanted, so coming back
  // doesn't mean finding the program again and pressing twice. While resuming
  // they have just signed in, so a 401 means the cookie didn't take — say so
  // rather than bouncing them round the loop again.
  const toSignIn = useCallback(
    (intent: "save" | "access") => {
      const next = encodeURIComponent(`/events/${event.id}?${intent}=1`);
      router.push(`/signup?next=${next}`);
    },
    [event.id, router],
  );

  const save = useCallback(
    async (resuming = false) => {
      setBusy(true);
      setError(null);
      try {
        const result = await attendEvent(event.id);
        setSaved(true);
        // Say whether a spot was held: the page can't redraw its own count.
        toast.show({
          title: "Event has been successfully saved!",
          description:
            event.capacity == null
              ? undefined
              : result.held_until
                ? `Your spot is held until ${clockTime(result.held_until)}.`
                : "No spot was free to hold, but it's in your saved list.",
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401 && !resuming) {
          toSignIn("save");
          return;
        }
        setError(apiMessage(e, "That didn't save. Please try again."));
      } finally {
        setBusy(false);
      }
    },
    [event.id, toSignIn, toast],
  );

  const ask = useCallback(
    async (resuming = false) => {
      const group = event.access_group;
      if (!group) return;
      setBusy(true);
      setError(null);
      try {
        const membership = await requestAccess(group.id, event.id);
        setAccess(membership.status);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401 && !resuming) {
          toSignIn("access");
          return;
        }
        // 409: the organization already decided. The message says so.
        if (e instanceof ApiError && e.status === 409) setAccess("declined");
        setError(apiMessage(e, "That didn't send. Please try again."));
      } finally {
        setBusy(false);
      }
    },
    [event.id, event.access_group, toSignIn],
  );

  // Returning from sign-in with the save or request still pending. Runs once;
  // a signed-out visitor who lands here with the flag simply gets nothing.
  const resumed = useRef(false);
  useEffect(() => {
    const pending =
      params.get("save") === "1"
        ? "save"
        : params.get("access") === "1"
          ? "access"
          : null;
    if (resumed.current || !pending) return;
    resumed.current = true;
    void (pending === "save" ? save(true) : ask(true));
    router.replace(`/events/${event.id}`);
  }, [params, save, ask, router, event.id]);

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

  const canSave = access === null || access === "approved";

  return (
    <>
      {maps && (
        <a
          href={maps}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("secondary", "lg")}
        >
          See on Map
          <GoogleMapsIcon />
        </a>
      )}
      {canSave ? (
        <Button
          variant={external || saved ? "secondary" : "primary"}
          size="lg"
          onClick={() => void save()}
          disabled={busy || saved}
          trailingIcon={saved ? <BookmarkCheck /> : <Bookmark />}
        >
          {saved ? "Event saved" : "Save event"}
        </Button>
      ) : (
        <AccessAction
          state={access}
          busy={busy || !accessKnown}
          onRequest={() => void ask()}
        />
      )}
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
