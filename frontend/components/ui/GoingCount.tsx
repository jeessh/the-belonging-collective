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
  className = "",
}: {
  count: number | null | undefined;
  onSignIn?: () => void;
  /** Where to sign in when there is no overlay to open. */
  signInHref?: string;
  className?: string;
}) {
  if (count === 0 || count === undefined) return null;
  if (count === null) {
    const look = `inline-flex min-h-11 items-center gap-3 text-fg underline decoration-line underline-offset-4 hover:decoration-fg ${className}`;
    return signInHref ? (
      <Link href={signInHref} className={look}>
        <Users aria-hidden="true" className="size-6 shrink-0 text-fg-icon" />
        See who else is going
      </Link>
    ) : (
      <button type="button" onClick={onSignIn} className={look}>
        <Users aria-hidden="true" className="size-6 shrink-0 text-fg-icon" />
        See who else is going
      </button>
    );
  }
  return (
    <span className={`inline-flex items-center gap-3 text-fg ${className}`}>
      <Users aria-hidden="true" className="size-6 shrink-0 text-fg-icon" />
      {count} going
    </span>
  );
}
