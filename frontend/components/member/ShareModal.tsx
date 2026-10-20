"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Copy, Send } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { INVALID_EMAIL, looksLikeEmail } from "@/lib/email";
import { ApiError, apiMessage, shareByEmail } from "@/lib/api";

/**
 * Share by email or by link, as the design draws it. Send has the site mail
 * the programs as designed cards (routes/share.py) — never a `mailto:`, whose
 * plain text is all a mail app would get. Copy Link puts the link on the
 * clipboard. Rendered into `document.body` so it can sit over another dialog.
 *
 * Without `link` it is the design's email-only sheet — a caregiver sharing
 * someone else's list, whose list link isn't theirs to hand out.
 */
export function ShareModal({
  title,
  eventIds,
  withListLink = false,
  link,
  onClose,
}: {
  title: string;
  /** The programs the email shows, one card each. */
  eventIds: string[];
  /** The email's button opens the member's live list page. */
  withListLink?: boolean;
  link?: {
    /** Fetched once when the sheet opens: the list link has to be minted. */
    getUrl: () => Promise<string>;
  };
  onClose: () => void;
}) {
  const { show } = useToast();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Once, on opening: the caller's object is new on every render.
  const [getUrl] = useState(() => link?.getUrl);
  useEffect(() => {
    if (!getUrl) return;
    let alive = true;
    getUrl()
      .then((url) => alive && setLinkUrl(url))
      .catch(() => alive && setLinkError("Couldn't make the link. Please try again."));
    return () => {
      alive = false;
    };
  }, [getUrl]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (!looksLikeEmail(email)) {
      setEmailError(INVALID_EMAIL);
      return;
    }
    setSending(true);
    try {
      await shareByEmail({
        to: email.trim(),
        event_ids: eventIds,
        with_list_link: withListLink,
      });
    } catch (err) {
      setSending(false);
      setEmailError(
        err instanceof ApiError && err.status === 401
          ? "Log in to share by email."
          : err instanceof ApiError && err.status === 422
            ? INVALID_EMAIL
            : err instanceof ApiError
              ? apiMessage(err, "Couldn't send that email. Please try again.")
              : "Couldn't reach the server. Please try again.",
      );
      return;
    }
    show({ title: "Email sent", description: `Sent to ${email.trim()}.` });
    onClose();
  }

  async function copyLink() {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
    } catch {
      // Clipboard access can be refused; the link is on screen to select.
      setLinkError("Copy didn't work here — select the link and copy it.");
      return;
    }
    show({ title: "Link copied" });
    onClose();
  }

  // z-[70]: over the event dialog it opens from, which EventDetailModal
  // lifts to z-[60] above the feed chrome. At Modal's own z-30 it opened
  // behind it, and Share looked like it did nothing.
  return createPortal(
    <div className="relative z-[70]">
      <Modal title={title} size="form" onClose={onClose}>
        <div className="mt-6 flex flex-col gap-6">
          <form
            onSubmit={send}
            noValidate
            className="flex flex-col gap-3 sm:flex-row sm:items-start"
          >
            <TextField
              label="Share by Email"
              type="email"
              autoComplete="email"
              placeholder="Enter Email"
              value={email}
              error={emailError}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              className="flex-1"
            />
            {/* Level with the field, below its label. */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              trailingIcon={<Send />}
              disabled={sending}
              className="sm:mt-9"
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </form>

          {link && (
            <div className="flex flex-col gap-2">
              <p className="text-lg font-medium text-fg">Share by Link</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <p className="min-h-14 min-w-0 flex-1 select-all break-all rounded-field border border-line bg-surface px-4 py-3 text-lg text-tag-paid-fg">
                  {linkUrl ?? (linkError ? "" : "Making your link…")}
                </p>
                <Button
                  size="lg"
                  onClick={() => void copyLink()}
                  disabled={!linkUrl}
                  trailingIcon={<Copy />}
                  className="shrink-0"
                >
                  Copy Link
                </Button>
              </div>
              {linkError && (
                <p role="alert" className="text-base text-danger-fg">
                  {linkError}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>,
    document.body,
  );
}
