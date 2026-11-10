"use client";

import { useMemo } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Heart, Sparkle } from "lucide-react";

/** The celebration a save can end with, at the spot on the saved board
    where the event lands. Tuned live with DialKit's "Save animation" panel
    (EventsView). Decorative only: nothing to read or press. */
export type BurstEffect = "none" | "confetti" | "sparkles" | "ring" | "hearts";

// The app's accent and tag colours, so the party matches the page.
const COLOURS = ["#38D0F5", "#94EAFF", "#7ED957", "#7FA7FF", "#FF9DB0", "#FFD166"];

export function SaveBurst({
  x,
  y,
  effect,
  count,
  spread,
  duration,
  onDone,
}: {
  /** Viewport point the burst starts from. */
  x: number;
  y: number;
  effect: BurstEffect;
  count: number;
  /** How far the pieces travel, px. */
  spread: number;
  /** Seconds. */
  duration: number;
  onDone: () => void;
}) {
  // One fixed set of random pieces per burst (the component is keyed per save).
  const pieces = useMemo(
    () =>
      Array.from({ length: Math.max(0, Math.round(count)) }, (_, i) => {
        const angle = (Math.PI * 2 * i) / Math.max(1, count) + (Math.random() - 0.5) * 0.6;
        const dist = spread * (0.55 + Math.random() * 0.45);
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          spin: (Math.random() - 0.5) * 720,
          colour: COLOURS[i % COLOURS.length],
          size: 6 + Math.random() * 6,
          delay: Math.random() * 0.08,
        };
      }),
    [count, spread],
  );

  if (effect === "none" || typeof document === "undefined") return null;

  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70]">
      {effect === "ring" ? (
        <motion.span
          className="absolute rounded-full border-4 border-primary-strong"
          style={{ left: x, top: y, width: 24, height: 24, marginLeft: -12, marginTop: -12 }}
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: spread / 12, opacity: 0 }}
          transition={{ duration, ease: [0.2, 0.7, 0.3, 1] }}
          onAnimationComplete={onDone}
        />
      ) : (
        pieces.map((p, i) => (
          <motion.span
            key={i}
            className="absolute block"
            style={{
              left: x,
              top: y,
              width: effect === "confetti" ? p.size : p.size + 6,
              height: effect === "confetti" ? p.size * 0.55 : p.size + 6,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              background: effect === "confetti" ? p.colour : undefined,
              color: p.colour,
              borderRadius: effect === "confetti" ? 2 : undefined,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: effect === "confetti" ? 1 : 0.2, rotate: 0 }}
            animate={{
              x: p.dx,
              // Confetti falls as it flies; sparkles and hearts drift up.
              y: effect === "confetti" ? [0, p.dy * 0.6, p.dy + spread * 0.6] : p.dy - spread * 0.2,
              opacity: [1, 1, 0],
              scale: effect === "confetti" ? 1 : [0.2, 1.2, 0.6],
              rotate: effect === "confetti" ? p.spin : 0,
            }}
            transition={{ duration, delay: p.delay, ease: "easeOut" }}
            onAnimationComplete={i === 0 ? onDone : undefined}
          >
            {effect === "sparkles" ? (
              <Sparkle className="size-full" fill="currentColor" strokeWidth={0} />
            ) : effect === "hearts" ? (
              <Heart className="size-full" fill="currentColor" strokeWidth={0} />
            ) : null}
          </motion.span>
        ))
      )}
    </div>,
    document.body,
  );
}
