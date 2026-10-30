import type { MouseEvent, ReactNode } from "react";
import { BackButton } from "@/components/ui/BackButton";

/**
 * The back button on its own line above, then the page title — with an
 * optional line under it ("Posted by …") — and the page's own buttons on the
 * title's row, at the right edge, their tops level with the top of the title.
 * From `lg` the buttons never wrap under the title; on a narrower screen they
 * drop below it, still right-aligned.
 */
export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back to events",
  onBack,
  actions,
}: {
  title: string;
  /** Muted text under the title, e.g. which organization the event is for. */
  subtitle?: ReactNode;
  backHref?: string;
  backLabel?: string;
  /** May preventDefault — the event form asks before dropping unsaved edits. */
  onBack?: (e: MouseEvent<HTMLElement>) => void;
  actions?: ReactNode;
}) {
  return (
    <div className="no-print flex flex-col items-start gap-2">
      {backHref && <BackButton href={backHref} label={backLabel} onClick={onBack} />}
      <div className="flex w-full flex-wrap items-start justify-between gap-4 lg:flex-nowrap">
        <div className="min-w-0">
          <h1 className="text-3xl font-medium text-fg sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1 text-base text-fg-muted">{subtitle}</p>}
        </div>
        {actions && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3 lg:shrink-0 lg:flex-nowrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
