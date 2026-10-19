"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Copy, Send } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { mailtoUrl } from "@/lib/share";

// Enough to catch a typo; the mail app has the last word.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Share by email or by link, as the design draws it. Nothing leaves through
 * the server: Send hands a `mailto:` to the member's own mail app, and Copy
 * Link puts the link on the clipboard. Rendered into `document.body` so it
 * can sit over another dialog.
 *
 * Without `link` it is the design's email-only sheet — a caregiver sharing
 * someone else's list, whose list link isn't theirs to hand out.
 */
export function ShareModal({
  title,
  subject,
  body,
  link,
  onClose,
}: {
  title: string;
  subject: string;
  body: string;
  link?: {
    /** Fetched once when the sheet opens: the list link has to be minted. */
    getUrl: () => Promise<string>;
    /** The line above the link at the top of the email, if it goes there. */
    intro?: string;
  };
  onClose: () => void;
}) {
  const { show } = useToast();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
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

  function send(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_SHAPE.test(email.trim())) {
      setEmailError("Enter a valid email address, like name@example.com.");
      return;
    }
    // A list goes out with its live link on top, so the message stays useful
    // after the programs in it change.
    const text =
      link?.intro && linkUrl ? `${link.intro}\n${linkUrl}\n\n${body}` : body;
    window.location.href = mailtoUrl(email, subject, text);
    // Nothing on this page can tell whether a mail app answered; say what
    // should have happened, so a member without one isn't left guessing.
    show({
      title: "Opening your email app",
      description: "The message is ready for you to send.",
      tone: "info",
    });
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
              className="sm:mt-9"
            >
              Send
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
