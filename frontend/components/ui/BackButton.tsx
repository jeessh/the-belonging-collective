import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The platform's one back control: an arrow, no words, just left of the
 * page's (or step's, or panel's) title. A link when it goes somewhere, a
 * button when it steps back inside a flow. `label` is what a screen reader
 * says — "Back to events", "Back".
 *
 * Every back in the app goes through here, so they all look and sit the
 * same; don't add a "Back" text button or a back link in a corner.
 */
export function BackButton({
  label,
  href,
  onClick,
}: {
  label: string;
  href?: string;
  /** With `href`, may preventDefault (the event form's unsaved-changes guard). */
  onClick?: (e: MouseEvent<HTMLElement>) => void;
}) {
  const cls =
    "back-button -ml-2 grid size-11 shrink-0 place-items-center rounded-control text-fg transition-colors hover:bg-surface-subtle";
  const icon = <ArrowLeft aria-hidden="true" className="size-7" />;
  return href ? (
    <Link href={href} aria-label={label} onClick={onClick} className={cls}>
      {icon}
    </Link>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {icon}
    </button>
  );
}

/** A title with the back arrow beside it (or just the title, without one). */
export function TitleWithBack({
  back,
  children,
}: {
  back?: { label: string; href?: string; onClick?: (e: MouseEvent<HTMLElement>) => void } | null;
  children: ReactNode;
}) {
  if (!back) return <>{children}</>;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <BackButton {...back} />
      {children}
    </div>
  );
}
