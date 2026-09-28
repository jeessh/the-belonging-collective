"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  categoryLabel,
  loadCategories,
  peekCategories,
  subscribeCategories,
  type Category,
} from "@/lib/categories";

const EMPTY: Category[] = [];

/**
 * The one way into the topic list: the live topics, in order, and a
 * `label(slug)` for stored values. `categories` is empty and `label` falls
 * back to prettifying the slug until the list lands, and both change (so the
 * caller re-renders) when it does. Kept apart from lib/categories so the pure
 * helpers there can be imported by server components.
 */
export function useCategories(): {
  categories: Category[];
  label: (slug?: string | null) => string;
} {
  const categories = useSyncExternalStore(
    subscribeCategories,
    () => peekCategories() ?? EMPTY,
    () => EMPTY,
  );
  useEffect(() => {
    if (!peekCategories()) void loadCategories().catch(() => {});
  }, [categories]);
  // A new function per list, so memos keyed on it recompute when it lands.
  const label = useMemo(
    () => (slug?: string | null) => categoryLabel(slug, categories),
    [categories],
  );
  return { categories, label };
}
