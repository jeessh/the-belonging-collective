import type { MouseEvent, ReactNode } from "react";
import { BackButton } from "@/components/ui/BackButton";

/**
 * Back arrow and page title — with an optional line under the title ("Posted
 * by …") — and the page's own buttons on the same row, at the right edge.
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
    <div className="no-print flex flex-wrap items-center justify-between gap-4 lg:flex-nowrap">
      <div className="flex min-w-0 items-center gap-2">
        {backHref && <BackButton href={backHref} label={backLabel} onClick={onBack} />}
        <div className="min-w-0">
          <h1 className="text-3xl font-medium text-fg sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1 text-base text-fg-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3 lg:shrink-0 lg:flex-nowrap">
          {actions}
        </div>
      )}
    </div>
  );
}
