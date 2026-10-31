import type { LucideIcon } from "lucide-react";

/**
 * A Lucide icon standing in for a word's picture — a topic, an access need,
 * an emblem — sized to the text around it (1em) and sitting on its line, so
 * it scales wherever it is used: a 14px console chip, a 30px sign-up tile.
 * Decorative: the label next to it says what it is.
 */
export function Glyph({
  icon: Icon,
  className = "",
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      // 2, like every other icon; globals.css draws it as a 2px line at
      // any size in the member app.
      strokeWidth={2}
      className={`inline-block size-[1em] shrink-0 align-[-0.125em] ${className}`}
    />
  );
}
