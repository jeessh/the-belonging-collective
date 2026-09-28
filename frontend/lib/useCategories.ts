"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  loadCategories,
  peekCategories,
  subscribeCategories,
  type Category,
} from "@/lib/categories";

const EMPTY: Category[] = [];

/**
 * The live topics, in order. Empty until loaded (and during the server pass).
 * Kept apart from lib/categories so the pure helpers there can be imported by
 * server components; this hook re-renders its callers when the list lands.
 */
export function useCategories(): Category[] {
  const rows = useSyncExternalStore(
    subscribeCategories,
    () => peekCategories() ?? EMPTY,
    () => EMPTY,
  );
  useEffect(() => {
    if (!peekCategories()) void loadCategories().catch(() => {});
  }, [rows]);
  return rows;
}
