"use client";

import { useCallback, useRef } from "react";
import { Modal } from "@/components/Modal";
import { MemberAuthFlow, type AuthEntry } from "@/components/member/MemberAuthFlow";

/** The pre-redesign accent, still read by RegisterPrompt. */
export const CYAN = "#35CDEE";

/**
 * Signing in without leaving the feed.
 *
 * Saving is the only thing that needs an account, and it's asked for at the
 * moment it's needed — the member keeps the program they were looking at on
 * screen behind the modal rather than being sent away to find it again.
 */
export function LoginOverlay({
  onClose,
  onSignedIn,
  onGuest,
  initial = "chooser",
}: {
  onClose: () => void;
  /** Fired once the cookie is set. */
  onSignedIn: () => void;
  /** "Continue as guest". Defaults to closing. */
  onGuest?: () => void;
  initial?: AuthEntry;
}) {
  // The Modal re-runs its focus setup whenever `onClose` changes identity,
  // and the feed passes a fresh arrow on every render — so it gets one stable
  // function that reads the latest through a ref.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => onCloseRef.current(), []);

  return (
    // Lifts the fixed Modal above the feed chrome, which sits at z-50.
    <div className="relative z-[60]">
      <MemberAuthFlow
        initial={initial}
        onSignedIn={() => onSignedIn()}
        onGuest={onGuest ?? close}
      >
        {(view) => (
          <Modal
            onClose={close}
            title={
              view.icon ? (
                <>
                  {view.icon}
                  <h2 className="text-2xl font-medium text-fg sm:text-3xl">
                    {view.title}
                  </h2>
                </>
              ) : (
                view.title
              )
            }
          >
            {view.subtitle && (
              <p className="mt-2 text-lg text-fg-muted">{view.subtitle}</p>
            )}
            {view.body}
          </Modal>
        )}
      </MemberAuthFlow>
    </div>
  );
}
