"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * The OS reduced-motion signal, applied to every Framer animation at once.
 * The main paths check `useReducedMotion` themselves; this is the net under
 * the ones that forget.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
