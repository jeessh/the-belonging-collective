import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Back = {
  /** The words on the button: "Back to events", "Back". */
  label: string;
  href?: string;
  /** With `href`, may preventDefault (the event form's unsaved-changes guard). */
  onClick?: (e: MouseEvent<HTMLElement>) => void;
};

/**
 * The platform's one back control: an arrow and its words ("← Back to
 * events"), sitting on its own line above the page's title. A link when it
 * goes somewhere, a button when it steps back inside a flow. Every back on a
 * page goes through here, so they all look and sit the same — don't add a
 * "Back" button in a footer or a back link in a corner.
 *
 * `inline` is the one exception, for modals (the sign-in sheet): just the
 * arrow, beside the title, where a line above would crowd the sheet.
 */
export function BackButton({ label, href, onClick, inline = false }: Back & { inline?: boolean }) {
  const cls = inline
    ? "back-button back-inline -ml-2 grid size-11 shrink-0 place-items-center rounded-control text-fg transition-colors hover:bg-surface-subtle"
    : "back-button -ml-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-control px-2 text-base font-medium text-fg transition-colors hover:bg-surface-subtle";
  const content = inline ? (
    <ArrowLeft aria-hidden="true" className="size-7" />
  ) : (
    <>
      <ArrowLeft aria-hidden="true" className="size-5 shrink-0" />
      {label}
    </>
  );
  const named = inline ? { "aria-label": label } : {};
  return href ? (
    <Link href={href} onClick={onClick} className={cls} {...named}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} {...named}>
      {content}
    </button>
  );
}

/**
 * A title with its back button: on the line above it, or — `inline`, for a
 * modal — the arrow beside it. Just the title without one.
 */
export function TitleWithBack({
  back,
  inline = false,
  children,
}: {
  back?: Back | null;
  inline?: boolean;
  children: ReactNode;
}) {
  if (!back) return <>{children}</>;
  if (inline)
    return (
      <div className="flex min-w-0 items-center gap-2">
        <BackButton {...back} inline />
        {children}
      </div>
    );
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <BackButton {...back} />
      {children}
    </div>
  );
}
