import Link from "next/link";
import { Users } from "lucide-react";

/**
 * "N going", or — when the API withholds the number from anonymous viewers
 * (`saved_count` is null) — a way to sign in: a button that opens the overlay
 * in the feed, or a link to `/signup` on the server-rendered page. Nothing at
 * zero: an empty room is not a selling point.
 */
export function GoingCount({
  count,
  onSignIn,
  signInHref,
  variant = "line",
  iconClassName = "size-6",
  className = "",
}: {
  count: number | null | undefined;
  onSignIn?: () => void;
  /** Where to sign in when there is no overlay to open. */
  signInHref?: string;
  /** `line` (default): icon + "N going". `tag`: the sheet's small grey "26 GOING" chip. */
  variant?: "line" | "tag";
  /** The people icon's size, to match the other fact icons beside it. */
  iconClassName?: string;
  className?: string;
}) {
  if (count === 0 || count === undefined) return null;
  if (variant === "tag") {
    // Compact places have no room for the sign-in nudge; say nothing instead.
    if (count === null) return null;
    return (
      <span
        className={`inline-flex items-center rounded-control bg-surface-subtle px-3 py-1 text-sm uppercase tracking-wide text-fg-muted ${className}`}
      >
        {count} going
      </span>
    );
  }
  if (count === null) {
    const look = `inline-flex min-h-11 items-center gap-3 text-fg underline decoration-line underline-offset-4 hover:decoration-fg ${className}`;
    return signInHref ? (
      <Link href={signInHref} className={look}>
        <Users aria-hidden="true" className={`shrink-0 text-fg-icon-muted ${iconClassName}`} />
        See who else is going
      </Link>
    ) : (
      <button type="button" onClick={onSignIn} className={look}>
        <Users aria-hidden="true" className={`shrink-0 text-fg-icon-muted ${iconClassName}`} />
        See who else is going
      </button>
    );
  }
  return (
    <span className={`inline-flex items-center gap-3 text-fg ${className}`}>
      <Users aria-hidden="true" className={`shrink-0 text-fg-icon-muted ${iconClassName}`} />
      {count} going
    </span>
  );
}
