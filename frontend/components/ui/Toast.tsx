"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type ToastTone = "success" | "info" | "alert";

export type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** e.g. Undo. Pressing it dismisses the toast. */
  action?: { label: string; onClick: () => void };
  /**
   * A second, quieter choice (the guest toast's "Later"). With it, the two
   * buttons sit in a row under the text and `action` becomes the primary one.
   */
  cancel?: { label: string; onClick?: () => void };
};

type ToastItem = ToastOptions & { id: number };

type ToastApi = {
  show: (opts: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS = 5000;

const TONE: Record<ToastTone, string> = {
  success: "border-toast-success bg-tag-free-bg",
  info: "border-toast-info bg-primary-soft",
  alert: "border-toast-alert bg-danger",
};

/** `const { show } = useToast(); show({ title: "Saved", action: { label: "Undo", onClick } })`. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast needs a ToastProvider above it");
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);
  const show = useCallback((opts: ToastOptions) => {
    const id = nextId.current++;
    setToasts((all) => [...all, { ...opts, id }]);
    return id;
  }, []);
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The live region is always mounted, so screen readers have it in
          hand before the first toast arrives rather than discovering it.
          z-[80] puts it over every dialog, the event dialog's z-[60] and
          the share / print sheets' z-[70] included. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-4 z-[80] flex flex-col items-center gap-3"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);

  // The clock stops while the pointer or focus is on the toast, so someone
  // reaching for Undo isn't racing it.
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDismiss, DURATION_MS);
    return () => clearTimeout(timer);
  }, [paused, onDismiss]);

  const tone = toast.tone ?? "success";

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
      className={`pointer-events-auto flex w-full max-w-lg items-center gap-4 rounded-control border-[3px] px-5 py-3 shadow-toast ${TONE[tone]}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xl font-medium leading-snug text-fg">
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-base text-fg-muted">{toast.description}</p>
        )}
        {toast.cancel && (
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              onClick={() => {
                toast.cancel?.onClick?.();
                onDismiss();
              }}
            >
              {toast.cancel.label}
            </Button>
            {toast.action && (
              <Button
                variant="primary"
                onClick={() => {
                  toast.action?.onClick();
                  onDismiss();
                }}
              >
                {toast.action.label}
              </Button>
            )}
          </div>
        )}
      </div>
      {toast.action && !toast.cancel && (
        <Button
          variant="secondary"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </Button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid size-11 shrink-0 place-items-center rounded-control text-fg-icon hover:bg-black/5"
      >
        <X aria-hidden="true" className="size-7" />
      </button>
    </motion.div>
  );
}
