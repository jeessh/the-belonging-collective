"use client";

import { useEffect } from "react";
import { applyTextScale, readTextScale } from "@/lib/textScale";

/** Applies the member's remembered text size on every page load. */
export function TextScaleRoot() {
  useEffect(() => {
    applyTextScale(readTextScale());
  }, []);
  return null;
}
