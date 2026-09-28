"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { ArrowDown, ArrowUp, GalleryVerticalEnd, List } from "lucide-react";
import {
  ApiError,
  api,
  apiMessage,
  fetchAllEvents,
  logout,
  requestAccess,
  updateMe,
  type Event,
  type Me,
  type MePrefs,
  type PreferredView,
} from "@/lib/api";
import { isUpcoming, whenLine } from "@/lib/time";
import { googleCalendarUrl } from "@/lib/calendar";
import { useTextToSpeech } from "@/lib/useTextToSpeech";
import { useSpeechCommands } from "@/lib/useSpeechCommands";
import { useHeadTracking } from "@/lib/useHeadTracking";
import { useHold } from "@/lib/useHold";
import { HeadCursor } from "@/components/HeadCursor";
import { CalibrationOverlay } from "@/components/CalibrationOverlay";
import { eventToSpeech } from "@/lib/eventSpeech";
import { SavedEvents } from "@/components/SavedEvents";
import { isTopmostDialog } from "@/components/Modal";
import {
  oneCardPerProgram,
  personalizedFeed,
  programKey,
  recommendedThisWeek,
} from "@/lib/feed";
import { useToast } from "@/components/ui/Toast";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { LoginOverlay } from "@/components/member/LoginOverlay";
import { EventDetailModal } from "@/components/member/EventDetailModal";
import { AccessibilityMenu, FeedHeader } from "@/components/member/FeedHeader";
import { SavedSidebar } from "@/components/member/SavedSidebar";
import {
  FOR_YOU_CHIP,
  FeedFilters,
  passesFilters,
  type FeedSort,
} from "@/components/member/FeedFilters";
import { FeedCard } from "@/components/member/FeedCard";
import { ListFeed } from "@/components/member/ListFeed";
import { Tour } from "@/components/member/Tour";

const DROP_THRESHOLD = 150; // drag-left px to save
const SWIPE_THRESHOLD = 90; // drag up/down px to page
const HOLD_MS = 1000; // ← held this long saves
const HOLD_TRAVEL = 140; // how far the card slides toward the sidebar while held

type ViewMode = PreferredView;

const VIEWS = [
  { value: "card" as const, label: "Card View", icon: <GalleryVerticalEnd /> },
  { value: "list" as const, label: "List View", icon: <List /> },
];

// What a signed-out visitor's browser remembers in place of a profile.
const VIEW_KEY = "tbc.preferred_view";
const TOURED_KEY = "tbc.toured";

// Storage can be missing or refuse (private windows, blocked site data);
// none of that is worth failing over.
function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* nothing to do */
  }
}

/** What the member was in the middle of when sign-in was asked for. */
type Pending = { kind: "save" | "access"; event: Event };

const startMs = (e: Event) =>
  e.starts_at ? new Date(e.starts_at).getTime() : 0;

export function EventsView({
  initialMe,
  eventsPromise,
  attendedPromise,
}: {
  /** Null when nobody is signed in — browsing is open, saving is not. */
  initialMe: Me | null;
  eventsPromise: Promise<Event[]>;
  attendedPromise: Promise<Event[]>;
}) {
  const reduceMotion = useReducedMotion();
  const toast = useToast();
  const [me, setMe] = useState<Me | null>(initialMe);
  const [events, setEvents] = useState<Event[]>([]);
  const [i, setI] = useState(0);
  // What the server says is saved (every occurrence row), plus this session's
  // optimistic saves. The card asks "is this id saved?"; the sidebar shows one
  // entry per program.
  const [savedEvents, setSavedEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">(
    "loading",
  );
  const [view, setView] = useState<"events" | "saved">("events");
  const [flying, setFlying] = useState(false);
  // A card is on its way to the sidebar — the drop zone tints.
  const [dragActive, setDragActive] = useState(false);
  const [srMessage, setSrMessage] = useState("");

  // Accessibility prefs (seeded from initialMe, persisted on toggle). A
  // signed-out visitor still gets every mode; they just live for the session.
  const [ttsEnabled, setTtsEnabled] = useState(
    initialMe?.tts_enabled ?? false,
  );
  const [voiceEnabled, setVoiceEnabled] = useState(
    initialMe?.voice_commands_enabled ?? false,
  );
  const [headEnabled, setHeadEnabled] = useState(
    initialMe?.eye_tracking_enabled ?? false,
  );
  const signedIn = me !== null;

  const [a11yOpen, setA11yOpen] = useState(false);
  // The view they last chose: on the profile, or in this browser when there
  // is no profile. This component only mounts on the client, after the
  // session check, so reading storage in the initializer is safe.
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (initialMe) return initialMe.preferred_view;
    return readLocal(VIEW_KEY) === "list" ? "list" : "card";
  });
  const [chips, setChips] = useState<Set<string>>(new Set());
  const [tourOpen, setTourOpen] = useState(false);
  const [sort, setSort] = useState<FeedSort>("foryou");
  // Open on a desktop, the rail below `lg` — the design is desktop-first.
  // Starts open on both server and client, then corrects after mount, so the
  // first client render matches the server's.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, []);
  // Below `sm` the saved column becomes a bar under the feed, and the card
  // drags on one axis so a finger can still scroll the page.
  const phone = useMediaQuery("(max-width: 639px)");
  // What someone was doing when they were asked to sign in — a save or an
  // access request — which completes once they have.
  const [authFor, setAuthFor] = useState<Pending | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [detailFor, setDetailFor] = useState<Event | null>(null);

  // Drag transforms (inner card).
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-180, 180], [-6, 6]);
  // Fly-to-sidebar transforms (outer wrapper).
  const flyX = useMotionValue(0);
  const flyY = useMotionValue(0);
  const cardScale = useMotionValue(1);
  const cardOpacity = useMotionValue(1);

  const cardWrapRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null); // fly target: the sidebar's zone

  const {
    supported: ttsSupported,
    speaking,
    speak,
    cancel: cancelSpeech,
  } = useTextToSpeech();

  // Consume the route's parallel prefetch; if it failed (e.g. a blip during the
  // auth check), fetch fresh now that we've mounted past the gate.
  useEffect(() => {
    let alive = true;
    eventsPromise
      .catch(() => fetchAllEvents())
      .then((evRes) => {
        if (!alive) return;
        setEvents(evRes);
        setStatus(evRes.length ? "ready" : "empty");
      })
      .catch(() => {
        if (alive) setStatus("empty");
      });
    return () => {
      alive = false;
    };
  }, [eventsPromise]);

  // Signed-out resolves to [] rather than rejecting, so no fallback here.
  useEffect(() => {
    let alive = true;
    attendedPromise
      .then((attended) => {
        if (alive) setSavedEvents(attended);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [attendedPromise]);

  const saved = useMemo(
    () => new Set(savedEvents.map((ev) => ev.id)),
    [savedEvents],
  );
  // The sidebar: upcoming, soonest first, one per program.
  const savedList = useMemo(
    () =>
      oneCardPerProgram(
        savedEvents.filter(isUpcoming).sort((a, b) => startMs(a) - startMs(b)),
      ),
    [savedEvents],
  );

  // The feed the member browses: their explicit filters applied, then ordered
  // by how well each program matches them ("For you") or by date. Nothing is
  // hidden by personalization — only the chips remove cards.
  //
  // Keyed on the two profile arrays rather than `me`: setPref rebuilds `me` on
  // every preference write, and toggling text-to-speech must not re-sort.
  const interests = me?.interest_categories;
  const accessPrefs = me?.accessibility_prefs;
  const dismissed = me?.dismissed_program_ids;
  const taste = useMemo(
    () => ({ interests: interests ?? [], accessPrefs: accessPrefs ?? [] }),
    [interests, accessPrefs],
  );

  // This week's picks. A section over the list and an opt-in chip over the
  // cards; never a change to the feed itself.
  const recommended = useMemo(
    () => (signedIn ? recommendedThisWeek(events, taste, dismissed ?? []) : []),
    [events, taste, dismissed, signedIn],
  );
  const recommendedKeys = useMemo(
    () => new Set(recommended.map(programKey)),
    [recommended],
  );
  const forYouOn =
    viewMode === "card" && recommended.length > 0 && chips.has(FOR_YOU_CHIP);

  const feed = useMemo(() => {
    // Measured from when it ends, so this week's session drops off as it
    // finishes and the next takes its place — see lib/time.
    const upcoming = events.filter(
      (ev) =>
        isUpcoming(ev) &&
        passesFilters(ev, chips) &&
        (!forYouOn || recommendedKeys.has(programKey(ev))),
    );
    // The server already orders by starts_at, so "Soonest" is its order.
    const ordered =
      sort === "foryou" ? personalizedFeed(upcoming, taste) : upcoming;
    return oneCardPerProgram(ordered);
  }, [events, chips, sort, taste, forYouOn, recommendedKeys]);

  // The list's section keeps to the member's own filters, like the rows.
  const recommendedShown = useMemo(
    () =>
      viewMode === "list"
        ? recommended.filter((ev) => passesFilters(ev, chips))
        : [],
    [viewMode, recommended, chips],
  );

  // A filter change can shorten the feed out from under the cursor.
  useEffect(() => {
    setI((n) => (n < feed.length ? n : 0));
  }, [feed.length]);

  const current = feed[i];

  // +1 = advancing (next slides up from below), -1 = going back.
  const [dir, setDir] = useState(1);
  const feedLenRef = useRef(feed.length);
  feedLenRef.current = feed.length;
  const next = useCallback(() => {
    setDir(1);
    setI((n) => (n + 1) % Math.max(feedLenRef.current, 1));
  }, []);
  const prev = useCallback(() => {
    setDir(-1);
    setI(
      (n) => (n - 1 + feedLenRef.current) % Math.max(feedLenRef.current, 1),
    );
  }, []);

  // Refs so the gesture and voice handlers keep a stable identity.
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const meRef = useRef(me);
  meRef.current = me;
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;
  const flyingRef = useRef(flying);
  flyingRef.current = flying;

  // Sign in over the feed rather than navigating away: the program stays on
  // screen behind the overlay.
  const toSignIn = useCallback((pending: Pending | null = null) => {
    setAuthFor(pending);
    setAuthOpen(true);
  }, []);

  // One program changed under us (an access request landed): every copy of
  // it on screen follows.
  const patchEvent = useCallback((id: string, patch: Partial<Event>) => {
    const apply = (ev: Event) => (ev.id === id ? { ...ev, ...patch } : ev);
    setEvents((evs) => evs.map(apply));
    setSavedEvents((evs) => evs.map(apply));
    setDetailFor((ev) => (ev ? apply(ev) : ev));
  }, []);

  /**
   * Re-read what is actually saved after a save or un-save has landed. Saving
   * a series-priced program enrols the member across the run, a rule the
   * server owns; the optimistic touch of one id is reconciled here.
   */
  const syncSaved = useCallback(async () => {
    if (!signedInRef.current) return;
    try {
      setSavedEvents(await api<Event[]>("/users/me/events"));
    } catch {
      /* leave the optimistic state; the next reload settles it */
    }
  }, []);

  // Counting the click before leaving; losing the count must never cost the
  // member the link.
  const openRegistration = useCallback((ev: Event) => {
    if (!ev.registration_url) return;
    window.open(ev.registration_url, "_blank", "noopener,noreferrer");
    void api(`/events/${ev.id}/registration-click`, { method: "POST" }).catch(
      () => {},
    );
  }, []);

  const attend = useCallback(
    async (ev: Event) => {
      if (savedRef.current.has(ev.id)) return;
      if (!signedInRef.current) {
        toSignIn({ kind: "save", event: ev });
        return;
      }
      setSrMessage(`Saved ${ev.title}`);
      setSavedEvents((prev) =>
        prev.some((e) => e.id === ev.id) ? prev : [...prev, ev],
      );
      try {
        await api(`/events/${ev.id}/attend`, { method: "POST" });
        // Saving is only a bookmark. Where registration lives on the
        // organizer's site, the next step is that, not the calendar.
        const external =
          ev.requires_signup &&
          ev.registration_mode === "external" &&
          !!ev.registration_url;
        const calendar = googleCalendarUrl(ev);
        toast.show({
          title: "Event saved",
          action: external
            ? { label: "Register", onClick: () => openRegistration(ev) }
            : calendar
              ? {
                  label: "Add to calendar",
                  onClick: () => window.open(calendar, "_blank", "noopener"),
                }
              : undefined,
        });
        void syncSaved();
      } catch (e) {
        // Roll back on any failure, including an expired session. Leaving it
        // would tell someone a program is saved when the server has no record.
        setSavedEvents((prev) => prev.filter((s) => s.id !== ev.id));
        if (e instanceof ApiError && e.status === 401) {
          toSignIn({ kind: "save", event: ev });
          return;
        }
        // 403: a restricted program whose approval has gone. The server's
        // sentence says what to do about it.
        if (e instanceof ApiError && e.status === 403) {
          toast.show({
            title: apiMessage(e, `Could not save ${ev.title}.`),
            tone: "alert",
          });
          return;
        }
        setSrMessage(`Could not save ${ev.title}. Please try again.`);
      }
    },
    [toSignIn, syncSaved, toast, openRegistration],
  );

  /**
   * Ask into a restricted program's group. Signed out, sign-in comes first
   * and the request completes after it, the same way a save does.
   */
  const requestAccessFor = useCallback(
    async (ev: Event) => {
      const group = ev.access_group;
      if (!group) return;
      if (!signedInRef.current) {
        toSignIn({ kind: "access", event: ev });
        return;
      }
      try {
        const membership = await requestAccess(group.id, ev.id);
        patchEvent(ev.id, { access_status: membership.status });
        setSrMessage(`Request sent for ${ev.title}.`);
        toast.show({ title: "Request sent", tone: "info" });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          toSignIn({ kind: "access", event: ev });
          return;
        }
        // 409: the organization already decided.
        if (e instanceof ApiError && e.status === 409) {
          patchEvent(ev.id, { access_status: "declined" });
        }
        toast.show({
          title: apiMessage(e, "Could not send the request."),
          tone: "alert",
        });
      }
    },
    [toSignIn, patchEvent, toast],
  );

  const unsave = useCallback(
    async (ev: Event) => {
      const before = savedEvents;
      setSavedEvents((prev) =>
        prev.filter((s) => programKey(s) !== programKey(ev)),
      );
      setSrMessage(`Removed ${ev.title}`);
      try {
        await api(`/events/${ev.id}/attend`, { method: "DELETE" });
        toast.show({
          title: `${ev.title} was unsaved`,
          tone: "info",
          action: { label: "Undo", onClick: () => void attend(ev) },
        });
        void syncSaved();
      } catch {
        setSavedEvents(before);
        setSrMessage(`Could not remove ${ev.title}.`);
      }
    },
    [savedEvents, syncSaved, toast, attend],
  );

  // Re-read the profile so the feed, the sidebar and the chrome all agree that
  // somebody is here now, then finish the save they came for.
  const handleSignedIn = useCallback(async () => {
    setAuthOpen(false);
    const pending = authFor;
    setAuthFor(null);
    try {
      const [profile, attended, refreshed] = await Promise.all([
        api<Me>("/users/me"),
        api<Event[]>("/users/me/events").catch(() => [] as Event[]),
        // "N going" is withheld from anonymous viewers, so the rows fetched
        // before sign-in carry null counts.
        fetchAllEvents().catch(() => null),
      ]);
      setMe(profile);
      setSavedEvents(attended);
      if (refreshed?.length) setEvents(refreshed);
      // The refs update on render; the pending save must not wait for one.
      meRef.current = profile;
      signedInRef.current = true;
      savedRef.current = new Set(attended.map((ev) => ev.id));
    } catch {
      /* the cookie is set; the next read will pick the profile up */
    }
    if (pending?.kind === "save") void attend(pending.event);
    if (pending?.kind === "access") void requestAccessFor(pending.event);
  }, [authFor, attend, requestAccessFor]);

  /**
   * Save the current card, flying it into the sidebar on the way. Every save
   * path lands here — drag, the ← hold, the Save button, voice and head
   * tracking — so they all end in the same place. `fromX` is where the card
   * already is when a drag or hold hands it over.
   */
  const flyToDrop = useCallback(
    async (fromX = 0) => {
      const ev = feed[i];
      if (!ev || flyingRef.current) return;
      // Signed out this opens sign-in and already-saved is a no-op; flying the
      // card away in either case would say something untrue.
      if (!signedInRef.current || savedRef.current.has(ev.id)) {
        void animate(x, 0, { duration: 0.2 });
        setDragActive(false);
        void attend(ev);
        return;
      }
      const wrap = cardWrapRef.current;
      const target = dropRef.current;
      if (reduceMotion || !wrap || !target) {
        x.set(0);
        setDragActive(false);
        await attend(ev);
        return;
      }

      setFlying(true);
      setDragActive(true);
      // The wrapper's box is where the card rests; the drag moved only the
      // inner element, so the hand-off puts that offset on the wrapper.
      const card = wrap.getBoundingClientRect();
      const drop = target.getBoundingClientRect();
      const dx = drop.left + drop.width / 2 - (card.left + card.width / 2);
      const dy = drop.top + drop.height / 2 - (card.top + card.height / 2);
      x.set(0);
      flyX.set(fromX);

      const EASE = [0.4, 0, 0.2, 1] as const;
      await animate(cardScale, 1.06, { duration: 0.12, ease: "easeOut" });
      await Promise.all([
        animate(flyX, dx, { duration: 0.46, ease: EASE }),
        animate(flyY, dy, { duration: 0.46, ease: EASE }),
        animate(cardScale, 0.1, { duration: 0.46, ease: EASE }),
        animate(cardOpacity, 0, { duration: 0.46, ease: "easeIn" }),
      ]);

      await attend(ev);
      next();
      flyX.set(0);
      flyY.set(0);
      cardScale.set(1);
      cardOpacity.set(1);
      setDragActive(false);
      setFlying(false);
    },
    [feed, i, reduceMotion, attend, next, x, flyX, flyY, cardScale, cardOpacity],
  );
  // Stable identity for the voice / head handlers and the Save button.
  const flyToDropRef = useRef(flyToDrop);
  flyToDropRef.current = flyToDrop;
  const saveFromButton = useCallback(() => void flyToDropRef.current(), []);

  const openSaved = useCallback(() => setView("saved"), []);
  const closeSaved = useCallback(() => setView("events"), []);

  // ---- preferences (persist to profile) ----
  const setPref = useCallback(async (patch: MePrefs) => {
    if (patch.tts_enabled !== undefined) setTtsEnabled(patch.tts_enabled);
    if (patch.voice_commands_enabled !== undefined)
      setVoiceEnabled(patch.voice_commands_enabled);
    if (patch.eye_tracking_enabled !== undefined)
      setHeadEnabled(patch.eye_tracking_enabled);
    setMe((m) => (m ? { ...m, ...patch } : m));
    try {
      await updateMe(patch);
    } catch {
      /* keep the optimistic state even if the write fails */
    }
  }, []);

  const toggleTts = useCallback(
    (v: boolean) => void setPref({ tts_enabled: v }),
    [setPref],
  );
  const toggleVoice = useCallback(
    (v: boolean) => void setPref({ voice_commands_enabled: v }),
    [setPref],
  );
  const toggleHead = useCallback(
    (v: boolean) => void setPref({ eye_tracking_enabled: v }),
    [setPref],
  );

  // Re-scoring reorders the feed under the cursor, so `i` goes to the top:
  // they just said what they want to see first, so show them that.
  const toggleInterest = useCallback(
    (label: string) => {
      const chosen = meRef.current?.interest_categories ?? [];
      const adding = !chosen.includes(label);
      void setPref({
        interest_categories: adding
          ? [...chosen, label]
          : chosen.filter((c) => c !== label),
      });
      setI(0);
      setSrMessage(
        `${adding ? "Added" : "Removed"} ${label}. Showing your best matches from the start.`,
      );
    },
    [setPref],
  );
  const toggleAccessPref = useCallback(
    (slug: string, label: string) => {
      const chosen = meRef.current?.accessibility_prefs ?? [];
      const adding = !chosen.includes(slug);
      void setPref({
        accessibility_prefs: adding
          ? [...chosen, slug]
          : chosen.filter((c) => c !== slug),
      });
      setI(0);
      setSrMessage(
        adding
          ? `Added ${label}. Showing programs that offer it first.`
          : `Removed ${label}. Showing your best matches from the start.`,
      );
    },
    [setPref],
  );

  const toggleChip = useCallback((chip: string) => {
    setChips((prev) => {
      const nextChips = new Set(prev);
      if (nextChips.has(chip)) nextChips.delete(chip);
      else nextChips.add(chip);
      return nextChips;
    });
    setI(0);
  }, []);

  // The view sticks: on the profile, or in this browser without one.
  const changeView = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      if (signedInRef.current) void setPref({ preferred_view: mode });
      else writeLocal(VIEW_KEY, mode);
    },
    [setPref],
  );

  // "Not for me" takes a pick out of the section, and only the section. The
  // list is the member's, so the whole of it goes up each time.
  const dismissRecommendation = useCallback(
    (ev: Event) => {
      const key = programKey(ev);
      const before = meRef.current?.dismissed_program_ids ?? [];
      if (before.includes(key)) return;
      void setPref({ dismissed_program_ids: [...before, key] });
      setSrMessage(`${ev.title} removed from For you.`);
      toast.show({
        title: `${ev.title} removed from For you`,
        tone: "info",
        action: {
          label: "Undo",
          onClick: () =>
            void setPref({
              dismissed_program_ids: (
                meRef.current?.dismissed_program_ids ?? []
              ).filter((id) => id !== key),
            }),
        },
      });
    },
    [setPref, toast],
  );

  const doLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      /* clear the session client-side regardless */
    }
    setMe(null);
    setSavedEvents([]);
    // The counts are for signed-in eyes; drop them rather than refetch.
    setEvents((evs) => evs.map((ev) => ({ ...ev, saved_count: null })));
    setDetailFor(null);
    closeSaved();
    setSrMessage("Signed out.");
  }, [closeSaved]);

  // The four actions voice and head tracking share. In the list there is no
  // focused card, so only opening the saved list still makes sense there.
  const cardActionsLive = view === "events" && viewMode === "card" && !tourOpen;
  const actionHandlers = useMemo(
    () => ({
      onNext: () => {
        if (cardActionsLive) next();
      },
      onBack: () =>
        view === "saved" ? closeSaved() : cardActionsLive && prev(),
      onAdd: () => {
        if (cardActionsLive) void flyToDropRef.current();
      },
      onSettings: () => (view === "saved" ? closeSaved() : openSaved()),
    }),
    [view, cardActionsLive, next, prev, closeSaved, openSaved],
  );

  const { supported: voiceSupported, listening, lastHeard } = useSpeechCommands(
    voiceEnabled,
    actionHandlers,
    // Mute the mic while the TTS bot is reading, so it doesn't hear itself.
    speaking,
  );

  const {
    supported: headSupported,
    calibrating,
    cursor,
    faceReady,
    error: headError,
    readProxy,
    recordCalibrationPoint,
    finishCalibration,
    setPreview,
  } = useHeadTracking(
    headEnabled,
    actionHandlers,
    // Freeze dwell while a panel is open so looking around doesn't fire actions.
    view === "saved" || a11yOpen || tourOpen,
  );

  // ---- first-run tour ----
  // Once the feed is up and nothing else is asking for attention. Checked
  // once per visit: a signed-in member's profile says whether they have seen
  // it; a visitor's browser does.
  const tourCheckedRef = useRef(false);
  useEffect(() => {
    if (tourCheckedRef.current || status !== "ready") return;
    if (authOpen || calibrating) return;
    tourCheckedRef.current = true;
    const seen = me ? me.onboarded_at !== null : readLocal(TOURED_KEY) === "1";
    if (!seen) setTourOpen(true);
  }, [status, authOpen, calibrating, me]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    cancelSpeech();
    if (meRef.current) {
      if (meRef.current.onboarded_at !== null) return;
      setMe((m) => (m ? { ...m, onboarded_at: new Date().toISOString() } : m));
      updateMe({ onboarded: true }).catch(() => {});
    } else {
      writeLocal(TOURED_KEY, "1");
    }
  }, [cancelSpeech]);

  const showTour = useCallback(() => {
    setA11yOpen(false);
    if (!authOpen && !calibrating) setTourOpen(true);
  }, [authOpen, calibrating]);

  // Say which program is in focus: the card is a div, not a live region.
  useEffect(() => {
    if (!current || view !== "events" || viewMode !== "card") return;
    const when = whenLine(current);
    setSrMessage(
      `${current.title}. ${when.day}${when.time ? `, ${when.time}` : ""}. ${
        current.location ?? ""
      }. ${i + 1} of ${feed.length}.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, view, viewMode]);

  // The section is a heading, not a live region.
  const picks = recommendedShown.length;
  useEffect(() => {
    if (picks > 0) {
      setSrMessage(
        `For you this week, ${picks} ${picks === 1 ? "program" : "programs"}.`,
      );
    }
  }, [picks]);

  // ---- text-to-speech: read the current event when it changes ----
  useEffect(() => {
    if (ttsEnabled && current && view === "events" && viewMode === "card") {
      speak(eventToSpeech(current));
    } else {
      cancelSpeech();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, current?.id, ttsEnabled, view, viewMode]);

  // ---- keyboard: ↑ previous, ↓ next, ← held saves ----
  const hold = useHold();
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (view === "saved") {
        // Not while a share sheet or print preview sits on top of the
        // panel — Escape is theirs first.
        if (
          e.key === "Escape" &&
          isTopmostDialog(
            document.querySelector('[role="dialog"][aria-label="All saved events"]'),
          )
        ) {
          closeSaved();
        }
        return;
      }
      // Don't steal arrows from whatever the person is actually using: a
      // field, a menu, the view toggle or the filter chips own their own keys.
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (
        target &&
        (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) ||
          target.isContentEditable ||
          target.closest(
            '[role="menu"], [role="dialog"], [role="radiogroup"], [role="group"]',
          ))
      ) {
        return;
      }
      if (viewMode !== "card") return;
      if (authOpen || detailFor || a11yOpen || flying || tourOpen) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (!e.repeat) next();
          break;
        case "ArrowUp":
          e.preventDefault();
          if (!e.repeat) prev();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.repeat || hold.holding()) return;
          setDragActive(true);
          hold.start(
            HOLD_MS,
            (p) => {
              if (!reduceMotion) x.set(-p * HOLD_TRAVEL);
            },
            () => void flyToDrop(reduceMotion ? 0 : -HOLD_TRAVEL),
          );
          break;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" || !hold.holding()) return;
      // Let go early: nothing saved, the card settles back.
      hold.cancel();
      setDragActive(false);
      void animate(x, 0, { duration: 0.2 });
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [
    view,
    viewMode,
    authOpen,
    detailFor,
    a11yOpen,
    flying,
    tourOpen,
    next,
    prev,
    closeSaved,
    hold,
    reduceMotion,
    x,
    flyToDrop,
  ]);

  // Only re-render for the tint when the answer changes, not every drag frame.
  const dragActiveRef = useRef(false);
  const setDragTint = (on: boolean) => {
    if (dragActiveRef.current === on) return;
    dragActiveRef.current = on;
    setDragActive(on);
  };

  if (status === "loading") {
    return (
      <main className="grid h-dvh place-items-center bg-surface text-fg-muted">
        <p className="text-2xl">Loading your programs…</p>
      </main>
    );
  }

  const name = me ? `${me.first_name} ${me.last_name.charAt(0)}.` : null;
  const heading =
    viewMode === "card"
      ? feed.length
        ? `Event ${i + 1} of ${feed.length}`
        : "No events"
      : `${feed.length} Unique ${feed.length === 1 ? "Event" : "Events"}`;

  return (
    <motion.main
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative flex h-dvh w-full select-none flex-col overflow-hidden bg-surface text-fg"
    >
      {/* head tracking: cursor + one-time calibration overlay */}
      {headEnabled && headSupported && <HeadCursor cursor={cursor} />}
      {headEnabled && headSupported && calibrating && (
        <CalibrationOverlay
          onPoint={recordCalibrationPoint}
          onDone={() => {
            finishCalibration();
            // Dwell is paused while the menu is open; close it so tracking
            // works the moment it goes live.
            setA11yOpen(false);
          }}
          onCancel={() => void setPref({ eye_tracking_enabled: false })}
          faceReady={faceReady}
          readProxy={readProxy}
          setPreview={setPreview}
        />
      )}
      {headEnabled && headSupported && !calibrating && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-full bg-fg/85 px-3 py-1.5 text-sm font-medium text-surface">
          <span
            className={`size-2 rounded-full ${cursor.visible ? "bg-tag-free-bg" : "bg-white/40"}`}
          />
          Head tracking on
        </div>
      )}
      {headEnabled && headError && (
        <div
          role="alert"
          className="pointer-events-none absolute bottom-16 left-4 z-40 max-w-xs rounded-control bg-danger px-3 py-2 text-sm font-medium text-danger-fg"
        >
          {headError}
        </div>
      )}

      {/* screen-reader announcement */}
      <p className="sr-only" role="status" aria-live="polite">
        {srMessage}
      </p>

      {voiceEnabled && listening && (
        <div
          className="pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full bg-fg/85 px-4 py-1.5 text-sm font-medium text-surface"
          role="status"
        >
          Listening…
        </div>
      )}

      <FeedHeader
        name={name}
        onSignIn={() => toSignIn()}
        onSignOut={() => void doLogout()}
      >
        <AccessibilityMenu
          open={a11yOpen}
          onOpenChange={setA11yOpen}
          ttsEnabled={ttsEnabled}
          voiceEnabled={voiceEnabled}
          ttsSupported={ttsSupported}
          voiceSupported={voiceSupported}
          onToggleTts={toggleTts}
          onToggleVoice={toggleVoice}
          headEnabled={headEnabled}
          headSupported={headSupported}
          onToggleHead={toggleHead}
          listening={voiceEnabled && listening}
          lastHeard={lastHeard}
          interests={me?.interest_categories ?? []}
          onToggleInterest={toggleInterest}
          accessPrefs={me?.accessibility_prefs ?? []}
          onToggleAccessPref={toggleAccessPref}
          signedIn={signedIn}
          onShowTour={showTour}
          onSignIn={() => {
            // The sign-in overlay covers this menu; leaving it open left a
            // hidden dialog still listening for Escape.
            setA11yOpen(false);
            toSignIn();
          }}
        />
      </FeedHeader>

      {/* The saved column sits beside the feed from `sm`; on a phone it is a
          bar under it, so it comes after the feed in the DOM as well. */}
      <div className="relative flex min-h-0 flex-1 max-sm:flex-col">
        {!phone && (
          <SavedSidebar
            ref={dropRef}
            layout={sidebarOpen ? "panel" : "rail"}
            onToggle={() => setSidebarOpen((o) => !o)}
            events={savedList}
            active={dragActive}
            signedIn={signedIn}
            onOpenSaved={openSaved}
            onOpenEvent={setDetailFor}
            onSignIn={() => toSignIn()}
          />
        )}

        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {/* The saved list opens over the main column; the sidebar stays. */}
          <SavedEvents
            me={me}
            open={view === "saved"}
            events={savedEvents}
            onClose={closeSaved}
            onSignIn={() => {
              closeSaved();
              toSignIn();
            }}
            onUnsave={(ev) => void unsave(ev)}
            onOpen={setDetailFor}
          />

          <div
            className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden p-4 sm:gap-8 sm:p-6 lg:p-9"
            style={{ pointerEvents: view === "saved" ? "none" : "auto" }}
          >
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
              <h1 className="text-3xl font-medium text-fg">{heading}</h1>
              <div data-tour="view">
                <SegmentedToggle
                  label="View"
                  segments={VIEWS}
                  value={viewMode}
                  onChange={changeView}
                />
              </div>
            </div>

            <FeedFilters
              chips={chips}
              onToggleChip={toggleChip}
              sort={sort}
              onSort={setSort}
              forYou={viewMode === "card" && recommended.length > 0}
            />

            {status === "empty" ? (
              <p className="py-16 text-center text-2xl text-fg-muted">
                No programs yet. Check back soon.
              </p>
            ) : viewMode === "list" ? (
              <ListFeed
                events={feed}
                recommended={recommendedShown}
                onDismiss={dismissRecommendation}
                onOpen={setDetailFor}
                onSignIn={() => toSignIn()}
              />
            ) : !current ? (
              <p className="py-16 text-center text-2xl text-fg-muted">
                No events match these filters.
              </p>
            ) : (
              /* card view: one card on a stacked deck, ↑ / ↓ beside it */
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
                <div className="relative w-full min-w-0 max-w-[880px]">
                  {/* the deck beneath — purely decorative */}
                  <div
                    aria-hidden
                    className="absolute inset-x-12 -bottom-6 top-12 rounded-card border border-line-card bg-surface-subtle/70"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-x-6 -bottom-3 top-6 rounded-card border border-line-card bg-surface-subtle"
                  />
                  <motion.div
                    ref={cardWrapRef}
                    style={{
                      x: flyX,
                      y: flyY,
                      scale: cardScale,
                      opacity: cardOpacity,
                    }}
                    className="relative z-10"
                  >
                    {/* Enter-only slide from the travel direction, keyed by id
                        so it never fights the drag transforms. */}
                    <motion.div
                      key={current.id}
                      initial={
                        reduceMotion
                          ? false
                          : { y: dir > 0 ? 80 : -80, opacity: 0 }
                      }
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 320, damping: 34 }}
                    >
                      <motion.div
                        // On a phone the card drags left only — a finger
                        // moving up or down is scrolling the page, and the
                        // ↑ / ↓ buttons under the card do the paging.
                        drag={flying ? false : phone ? "x" : true}
                        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                        dragElastic={0.65}
                        style={{
                          x,
                          y,
                          rotate: reduceMotion ? 0 : rotate,
                          touchAction: phone ? "pan-y" : "none",
                        }}
                        whileDrag={reduceMotion ? undefined : { scale: 1.02 }}
                        onDrag={(_, info) => {
                          // Leftward travel is a save in progress; anything
                          // else leaves the zone alone.
                          const dx = info.offset.x;
                          setDragTint(
                            dx < -24 && Math.abs(dx) > Math.abs(info.offset.y),
                          );
                        }}
                        onDragEnd={(_, info) => {
                          setDragTint(false);
                          const { x: dx, y: dy } = info.offset;
                          if (Math.abs(dx) > Math.abs(dy)) {
                            // Let go over the zone counts too. The zone is the
                            // whole left column beside the feed, or the bar
                            // under it on a phone — so both edges are checked.
                            const zone = dropRef.current?.getBoundingClientRect();
                            const over = zone
                              ? info.point.x <= zone.right &&
                                info.point.y >= zone.top &&
                                info.point.y <= zone.bottom
                              : false;
                            if (dx < -DROP_THRESHOLD || over) {
                              void flyToDrop(x.get());
                            }
                            return;
                          }
                          // Vertical travel pages, like the ↑ / ↓ buttons.
                          if (dy > SWIPE_THRESHOLD) next();
                          else if (dy < -SWIPE_THRESHOLD) prev();
                        }}
                        className={`${flying ? "" : "cursor-grab active:cursor-grabbing"} ${
                          dragActive ? "shadow-lift" : ""
                        } rounded-card`}
                      >
                        <FeedCard
                          event={current}
                          saved={saved.has(current.id)}
                          recommended={recommendedKeys.has(programKey(current))}
                          onMoreInfo={setDetailFor}
                          onSave={saveFromButton}
                          onSignIn={() => toSignIn()}
                        />
                      </motion.div>
                    </motion.div>
                  </motion.div>
                </div>

                <div
                  className="flex shrink-0 gap-6 sm:flex-col sm:pt-24"
                  data-tour="arrows"
                >
                  <button
                    type="button"
                    aria-label="Previous event"
                    onClick={prev}
                    disabled={flying}
                    className="grid size-24 place-items-center rounded-xl border border-line bg-surface-subtle text-fg transition-colors hover:bg-primary-soft disabled:opacity-50"
                  >
                    <ArrowUp aria-hidden="true" className="size-12" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next event"
                    onClick={next}
                    disabled={flying}
                    className="grid size-24 place-items-center rounded-xl border border-line bg-surface-subtle text-fg transition-colors hover:bg-primary-soft disabled:opacity-50"
                  >
                    <ArrowDown aria-hidden="true" className="size-12" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {phone && (
          <SavedSidebar
            ref={dropRef}
            layout="bar"
            onToggle={() => setSidebarOpen((o) => !o)}
            events={savedList}
            active={dragActive}
            signedIn={signedIn}
            onOpenSaved={openSaved}
            onOpenEvent={setDetailFor}
            onSignIn={() => toSignIn()}
          />
        )}
      </div>

      {detailFor && (
        <EventDetailModal
          event={detailFor}
          saved={saved.has(detailFor.id)}
          onClose={() => setDetailFor(null)}
          onSave={(ev) => void attend(ev)}
          onUnsave={(ev) => void unsave(ev)}
          onOpenRegistration={openRegistration}
          onRequestAccess={requestAccessFor}
          onSignIn={() => toSignIn()}
        />
      )}

      {/* Never over sign-in or calibration: the opener waits for both, and
          this keeps it out of the way should either come up meanwhile. */}
      {tourOpen && !authOpen && !calibrating && (
        <Tour
          signedIn={signedIn}
          phone={phone}
          speak={ttsEnabled && ttsSupported ? speak : undefined}
          onClose={closeTour}
        />
      )}

      {/* Last, so it stacks above the listing it was opened from — saving
          there while signed out asks for sign-in on top of it, and Escape
          reaches the sign-in first. */}
      {authOpen && (
        <LoginOverlay
          onClose={() => {
            setAuthOpen(false);
            setAuthFor(null);
          }}
          onSignedIn={() => void handleSignedIn()}
        />
      )}
    </motion.main>
  );
}
