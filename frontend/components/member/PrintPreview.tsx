"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Eye, Printer } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/Button";

/**
 * What will come out of the printer, then the browser's own dialog. The body
 * is the `.print-target` from globals.css, so the page around it — including
 * this dialog's chrome — stays off the paper.
 */
export function PrintPreview({
  title,
  printLabel,
  children,
  onClose,
}: {
  title: string;
  /** "Print Event" or "Print List". */
  printLabel: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return createPortal(
    <Modal
      size="lg"
      onClose={onClose}
      title={
        <>
          <p className="-mx-6 -mt-6 mb-6 flex items-center gap-3 rounded-t-card bg-primary-soft px-6 py-4 text-lg text-fg sm:-mx-10 sm:-mt-10 sm:px-10">
            <Eye aria-hidden="true" className="size-6" />
            Printing Preview
          </p>
          <h2 className="text-2xl font-medium text-fg sm:text-3xl">{title}</h2>
        </>
      }
    >
      <div className="print-target mt-6 max-h-[55vh] overflow-y-auto">
        {children}
      </div>
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
    </Modal>,
    document.body,
  );
}
