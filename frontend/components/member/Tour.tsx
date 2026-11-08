"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpDown,
  Bookmark,
  BookmarkCheck,
  Info,
  PersonStanding,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FOCUSABLE, isTopmostDialog } from "@/components/Modal";

type Step = {
  icon: ReactNode;
  title: string;
  body: string;
  /** `data-tour` names to spotlight, when they are on screen. */
  targets: string[];
  /** Play a cursor dragging an event onto the saved panel over the page. */
  dragDemo?: boolean;
};

function stepsFor(): Step[] {
  return [
    {
      icon: <ArrowUpDown />,
      title: "Find programs",
      body: "Use the arrows, or swipe, to see each one.",
      targets: ["arrows"],
    },
    {
      icon: <Bookmark />,
      title: "Save what you like",
      body: "Drag an event into Saved Events on the left to save it. Or tap \u201cSave event\u201d.",
      targets: ["card", "saved"],
      dragDemo: true,
    },
    {
      icon: <Info />,
      title: "Learn more",
      body: "Tap More information for details, map, share and print.",
      targets: ["more"],
    },
    {
      icon: <SlidersHorizontal />,
      title: "Filter and view",
      body: "Filter through events by topic. Switch between card mode and list mode.",
      targets: ["filters", "view"],
    },
    {
      icon: <BookmarkCheck />,
      title: "Your saved events",
      body: "Saved events are your bookmarks. Find them here anytime.",
      targets: ["saved"],
    },
    {
      icon: <PersonStanding />,
      title: "Accessibility Tools",
      body: "Read aloud, voice commands and head control.",
      targets: ["a11y"],
    },
  ];
}

type Rect = { left: number; top: number; width: number; height: number };

type DragPath = { from: { x: number; y: number }; to: { x: number; y: number } };

/** From the middle of the event card on screen to the middle of the saved
    panel; null when either isn't showing. */
function dragPath(): DragPath | null {
  const card = document.querySelector<HTMLElement>('[data-tour="card"]');
  const saved = Array.from(
    document.querySelectorAll<HTMLElement>('[data-tour="saved"]'),
  ).find((el) => el.offsetParent !== null);
  if (!card || !saved || card.offsetParent === null) return null;
  const a = card.getBoundingClientRect();
  const b = saved.getBoundingClientRect();
  return {
    from: { x: a.left + a.width / 2, y: a.top + a.height / 2 },
    to: { x: b.left + b.width / 2, y: b.top + Math.min(b.height / 2, 220) },
  };
}

const DEMO_S = 3.4; // one pass of the drag demo, seconds
// Phases of a pass: glide in, press, carry, drop, rest.
const T = [0, 0.18, 0.28, 0.72, 0.82, 1];

/**
 * A cursor that glides onto the event card, grabs it, carries a mini card
 * across to Saved Events and lets go, over and over, while the step is up.
 * Drawn over the spotlight, never hit-testable; skipped for reduced motion
 * and on a phone (where a finger does it, not a cursor).
 */
function DragDemo({ path }: { path: DragPath }) {
  const { from, to } = path;
  const loop = {
    duration: DEMO_S,
    times: T,
    repeat: Infinity,
    repeatDelay: 0.4,
    ease: "easeInOut" as const,
  };
  const xs = [from.x + 90, from.x, from.x, to.x, to.x, to.x];
  const ys = [from.y + 60, from.y, from.y, to.y, to.y, to.y];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      {/* The mini card, held just under the cursor's fingers. */}
      <motion.div
        className="absolute left-0 top-0 flex w-[150px] flex-col gap-2 rounded-card border-2 border-line-card bg-surface p-2 shadow-lift"
        style={{ translateX: "-50%", translateY: "-30%" }}
        animate={{
          x: xs,
          y: ys,
          opacity: [0, 0, 1, 1, 0, 0],
          scale: [0.9, 0.9, 1, 1, 0.85, 0.85],
          rotate: [0, 0, -3, -3, 0, 0],
        }}
        transition={loop}
      >
        <span className="block aspect-[2/1] w-full rounded-control bg-primary-soft" />
        <span className="block h-3 w-4/5 rounded-full bg-line-card" />
        <span className="block h-3 w-1/2 rounded-full bg-line-card" />
      </motion.div>
      {/* The cursor: an arrow, then the closed hand while it carries. */}
      <motion.div
        className="absolute left-0 top-0 size-10"
        animate={{ x: xs, y: ys, opacity: [0, 1, 1, 1, 1, 0] }}
        transition={loop}
      >
        {/* Swapped by CSS (globals.css, .tour-arrow / .tour-grab) on the
            same 3.8s cycle as the motion above. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cursors/arrow@2x.png" alt="" className="tour-arrow absolute inset-0 size-10" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cursors/grabbing@2x.png"
          alt=""
          className="tour-grab absolute -left-5 -top-5 size-10 opacity-0"
        />
      </motion.div>
    </div>
  );
}

const PAD = 8; // ring clearance around the target
const GAP = 16; // between the ring and the card
const CARD_W = 360;
const CARD_H = 300; // generous; the card is placed where this fits

/** The smallest box around every on-screen target of the step. */
function unionRect(names: string[]): Rect | null {
  let box: Rect | null = null;
  for (const name of names) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
    if (!el || el.offsetParent === null) continue;
    const r = el.getBoundingClientRect();
    if (!box) {
      box = { left: r.left, top: r.top, width: r.width, height: r.height };
      continue;
    }
    const left = Math.min(box.left, r.left);
    const top = Math.min(box.top, r.top);
    const right = Math.max(box.left + box.width, r.right);
    const bottom = Math.max(box.top + box.height, r.bottom);
    box = { left, top, width: right - left, height: bottom - top };
  }
  return box;
}

/**
 * The first-run walk through the feed: six steps, each an icon, a few words
 * and one sentence, over a spotlight on the control it means. A proper
 * dialog — focus stays inside, Escape skips — drawn as a bottom sheet on a
 * phone and a card beside the spotlight otherwise.
 */
export function Tour({
  phone,
  speak,
  onClose,
}: {
  phone: boolean;
  /** Reads each step aloud; pass it only while text-to-speech is on. */
  speak?: (text: string) => void;
  /** `finished` is false for Skip. */
  onClose: (finished: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  const steps = useMemo(() => stepsFor(), []);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [demo, setDemo] = useState<DragPath | null>(null);
  const step = steps[index];
  const last = index === steps.length - 1;
  const titleId = useId();
  const bodyId = useId();

  const panelRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Bring the step's control into view, then follow it while anything
  // scrolls or the window resizes.
  useLayoutEffect(() => {
    const names = step.targets;
    const first = document.querySelector<HTMLElement>(
      `[data-tour="${names[0]}"]`,
    );
    // Centred on a phone, so the control sits clear of the sheet below it.
    first?.scrollIntoView({
      block: phone ? "center" : "nearest",
      inline: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
    const measure = () => {
      setRect(unionRect(names));
      setDemo(step.dragDemo && !reduceMotion && !phone ? dragPath() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, phone, reduceMotion]);

  // Focus, keyboard, and focus restore — the same rules as Modal.
  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    nextRef.current?.focus();
    const panel = panelRef.current;
    function onKeyDown(e: KeyboardEvent) {
      if (!panel || !isTopmostDialog(panel)) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || active === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      restoreRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    speak?.(`${step.title}. ${step.body}`);
  }, [step, speak]);

  // Beside the spotlight where it fits — below, else above — otherwise the
  // bottom corner, which is also where it goes when there is nothing to light.
  let place: React.CSSProperties;
  if (phone) {
    place = { left: 0, right: 0, bottom: 0 };
  } else if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(
      Math.max(rect.left - PAD, GAP),
      vw - CARD_W - GAP,
    );
    const below = rect.top + rect.height + PAD + GAP;
    const above = rect.top - PAD - GAP;
    if (below + CARD_H <= vh) place = { left, top: below };
    else if (above - CARD_H >= 0) place = { left, bottom: vh - above };
    else place = { right: GAP, bottom: GAP };
  } else {
    place = { right: GAP, bottom: GAP };
  }

  return (
    <div className="fixed inset-0 z-[55]">
      {/* Spotlight: the ring's shadow dims everything but the target. With
          no target on screen the whole page dims. */}
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-card border-4 border-primary-border"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 200vmax rgba(26, 26, 26, 0.45)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-fg/45" />
      )}

      {demo && <DragDemo key={index} path={demo} />}

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        style={place}
        className={`absolute flex flex-col gap-4 border border-line bg-surface p-5 shadow-lift outline-none sm:p-6 ${
          phone ? "rounded-t-card" : "w-[360px] rounded-card"
        }`}
      >
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-full bg-primary-soft text-fg [&>svg]:size-8"
          >
            {step.icon}
          </span>
          <div className="min-w-0">
            <p className="text-base uppercase tracking-wide text-fg-muted">
              Step {index + 1} of {steps.length}
            </p>
            <h2 id={titleId} className="text-2xl font-medium leading-tight text-fg">
              {step.title}
            </h2>
          </div>
        </div>
        <p id={bodyId} className="text-lg text-fg">
          {step.body}
        </p>
        {/* The heading changes in place; this reads the new step out. */}
        <p className="sr-only" aria-live="polite">
          Step {index + 1} of {steps.length}. {step.title}. {step.body}
        </p>

        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => onClose(false)}>
            Skip
          </Button>
          <div className="ml-auto flex gap-3">
            {index > 0 && (
              <Button onClick={() => setIndex((n) => n - 1)}>Back</Button>
            )}
            <Button
              ref={nextRef}
              variant="primary"
              onClick={() => (last ? onClose(true) : setIndex((n) => n + 1))}
            >
              {last ? "Start" : "Next"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
