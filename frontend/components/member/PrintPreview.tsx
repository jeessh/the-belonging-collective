"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Eye, Printer } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/Button";
import { longDate } from "@/lib/time";

/**
 * What will come out of the printer, then the browser's own dialog.
 *
 * The paper is a second copy of `children`, portalled straight under
 * `<body>` as the `.print-target` (globals.css hides everything else). It
 * used to be the preview's own scroll box, inside the centred dialog: the
 * page printed from wherever the dialog sat, so the first sheet started half
 * way down, and the dialog's height cut the rest off after one page. The
 * title was outside the box and never reached the paper either.
 */
export function PrintPreview({
  title,
  printLabel,
  titleOnPaper = true,
  children,
  onClose,
}: {
  title: string;
  /** "Print Event" or "Print List". */
  printLabel: string;
  /** False when `children` already starts with the title, as a program does. */
  titleOnPaper?: boolean;
  children: ReactNode;
  onClose: () => void;
}) {
  // z-[70]: over the event dialog it opens from (EventDetailModal's
  // z-[60]); at Modal's own z-30 it opened behind it.
  return (
    <>
      {createPortal(
        <div className="relative z-[70]">
          <Modal
            size="lg"
            onClose={onClose}
            title={
              <>
                {/* Full-bleed across the panel's top, under the ×: the
                    negative margins undo the panel's padding (p-6 / sm:p-12)
                    and the heading's pr-12, and the band's height centres
                    its text on the × (top-4 / sm:top-[26px], 44px tall). */}
                <p className="-ml-6 -mr-[72px] -mt-6 mb-6 flex h-[76px] items-center gap-3 rounded-t-card bg-primary-soft px-6 text-lg text-fg sm:-ml-12 sm:-mr-24 sm:-mt-12 sm:mb-8 sm:h-24 sm:px-12">
                  <Eye aria-hidden="true" className="size-6" />
                  Printing Preview
                </p>
                <h2 className="text-2xl font-medium text-fg sm:text-3xl">
                  {title}
                </h2>
              </>
            }
          >
            <div className="mt-6 max-h-[55vh] overflow-y-auto">{children}</div>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row [&>*]:flex-1">
              <Button size="lg" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={() => window.print()}
                trailingIcon={<Printer />}
              >
                {printLabel}
              </Button>
            </div>
          </Modal>
        </div>,
        document.body,
      )}
      {createPortal(
        <div aria-hidden="true" className="print-target print-sheet">
          <header className="print-sheet-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kwhab-logo.png" alt="" className="h-9 w-auto" />
            <span className="text-lg font-medium">The Belonging Collective</span>
            <span className="ml-auto text-base text-fg-muted">
              Printed {longDate(new Date().toISOString())}
            </span>
          </header>
          {titleOnPaper && (
            <h1 className="mb-6 text-3xl font-medium text-fg">{title}</h1>
          )}
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}
