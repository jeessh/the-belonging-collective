"use client";

import { useEffect, useState } from "react";

/**
 * The member's text size (Accessibility Tools → Text size): a multiplier on
 * every Tailwind `text-*` size (tailwind.config.ts reads `--text-scale`),
 * so text grows and the spacing and layout stay put. Kept in this browser
 * (localStorage, try/catch); the console resets it to 1 (`.console`).
 */
export const TEXT_SCALE = { min: 1, max: 1.5, step: 0.1 } as const;
const KEY = "tbc.text_scale";
const EVENT = "tbc:text-scale";

function clamp(v: number) {
  if (!Number.isFinite(v)) return 1;
  return Math.min(TEXT_SCALE.max, Math.max(TEXT_SCALE.min, Math.round(v * 10) / 10));
}

export function readTextScale(): number {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? clamp(parseFloat(raw)) : 1;
  } catch {
    return 1;
  }
}

export function applyTextScale(v: number) {
  document.documentElement.style.setProperty("--text-scale", String(clamp(v)));
}

export function saveTextScale(v: number) {
  const value = clamp(v);
  applyTextScale(value);
  try {
    window.localStorage.setItem(KEY, String(value));
  } catch {
    /* private window — it lasts for this page only */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}

/** The current scale and a setter that applies and remembers it. */
export function useTextScale(): [number, (v: number) => void] {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    setScale(readTextScale());
    const on = (e: Event) => setScale((e as CustomEvent<number>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return [scale, saveTextScale];
}
