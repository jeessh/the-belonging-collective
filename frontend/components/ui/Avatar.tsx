import { User } from "lucide-react";
import { hashColor } from "@/lib/dimensions";

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
 * Initials on a colour that stays put for the same name; the grey
 * silhouette when there is nobody signed in.
 */
export function Avatar({
  name,
  size = 36,
  className = "",
}: {
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (!name) {
    return (
      <span
        aria-hidden="true"
        style={style}
        className={`inline-grid shrink-0 place-items-center rounded-full bg-surface-subtle text-fg-icon-muted ${className}`}
      >
        <User style={{ width: size * 0.6, height: size * 0.6 }} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, backgroundColor: hashColor(name) }}
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold leading-none text-white ${className}`}
    >
      {initials(name)}
    </span>
  );
}
