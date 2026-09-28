import { User } from "lucide-react";
import { hashColor } from "@/lib/dimensions";
import { emblemEmoji } from "@/lib/emblems";

/** "Sophie L." → "SL"; "Sophie" → "S". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/**
 * The member's photo or emblem when they chose one; otherwise initials on a
 * colour that stays put for the same name; the grey silhouette when there is
 * nobody signed in.
 */
export function Avatar({
  name,
  src,
  emblem,
  size = 36,
  className = "",
}: {
  name?: string | null;
  /** An uploaded photo. */
  src?: string | null;
  /** An emblem slug from lib/emblems. */
  emblem?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  const base = `inline-grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`;
  if (!name) {
    return (
      <span
        aria-hidden="true"
        style={style}
        className={`${base} bg-surface-subtle text-fg-icon-muted`}
      >
        <User style={{ width: size * 0.6, height: size * 0.6 }} />
      </span>
    );
  }
  if (src) {
    return (
      <span aria-hidden="true" style={style} className={`${base} bg-surface-subtle`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  const emoji = emblemEmoji(emblem);
  if (emoji) {
    return (
      <span
        aria-hidden="true"
        style={{ ...style, fontSize: size * 0.55 }}
        className={`${base} bg-primary-soft leading-none`}
      >
        {emoji}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, backgroundColor: hashColor(name) }}
      className={`${base} font-semibold leading-none text-white`}
    >
      {initials(name)}
    </span>
  );
}
