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
 * The platform's one back control on a page: an arrow and its words ("← Back
 * to events"), on its own line above the page's title. A link when it goes
 * somewhere, a button when it steps back inside a flow. Every page's back
 * goes through here, so they all look and sit the same.
 *
 * Modals don't use it: there, back is a secondary button beside the primary
 * one (Back | Next — `FormFooter`), as the sign-in sheet does.
 */
export function BackButton({ label, href, onClick }: Back) {
  const cls =
    "back-button -ml-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-control px-2 text-base font-medium text-fg transition-colors hover:bg-surface-subtle";
  const content = (
    <>
      <ArrowLeft aria-hidden="true" className="size-5 shrink-0" />
      {label}
    </>
  );
  return href ? (
    <Link href={href} onClick={onClick} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );
}

/** A title with its back button on the line above (just the title without one). */
export function TitleWithBack({ back, children }: { back?: Back | null; children: ReactNode }) {
  if (!back) return <>{children}</>;
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <BackButton {...back} />
      {children}
    </div>
  );
}
