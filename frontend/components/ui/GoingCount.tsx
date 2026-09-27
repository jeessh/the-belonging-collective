import { Users } from "lucide-react";

/**
 * "N going", or — when the API withholds the number from anonymous viewers
 * (`saved_count` is null) — a button that opens sign-in. Nothing at zero:
 * an empty room is not a selling point.
 */
export function GoingCount({
  count,
  onSignIn,
  className = "",
}: {
  count: number | null | undefined;
  onSignIn?: () => void;
  className?: string;
}) {
  if (count === 0 || count === undefined) return null;
  if (count === null) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className={`inline-flex min-h-11 items-center gap-3 text-fg underline decoration-line underline-offset-4 hover:decoration-fg ${className}`}
      >
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
