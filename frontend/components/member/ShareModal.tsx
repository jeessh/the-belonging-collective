"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Copy, Link2, Send } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { mailtoUrl } from "@/lib/share";

/**
 * Share by email or by copying. Nothing leaves through the server: Send hands
 * a `mailto:` to the member's own mail app, and Copy puts the text on the
 * clipboard. Rendered into `document.body` so it can sit over another dialog.
 */
export function ShareModal({
  title,
  subject,
  body,
  copy,
  link,
  onClose,
}: {
  title: string;
  subject: string;
  body: string;
  /** What Copy copies, and how the row is labelled. */
  copy: { label: string; text: string };
  /**
   * A second thing to copy that has to be fetched first — the member's list
   * link. Shown as one button; the URL appears in the row once it is known.
   */
  link?: {
    label: string;
    /** The line above the link in an emailed list. */
    intro: string;
    /** Shown in the row until the link is made. */
    note: string;
    getUrl: () => Promise<string>;
  };
  onClose: () => void;
}) {
  const { show } = useToast();
  const [email, setEmail] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  async function copyLink() {
    if (!link) return;
    setLinkError(null);
    let url: string;
    try {
      url = await getLinkUrl();
    } catch {
      setLinkError("Couldn't make the link. Please try again.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      setCopyFailed(true);
      return;
    }
    show({ title: "Link copied" });
    onClose();
  }

  async function getLinkUrl(): Promise<string> {
    if (linkUrl) return linkUrl;
    const url = await link!.getUrl();
    setLinkUrl(url);
    return url;
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    // A list goes out with its live link on top, so the message stays
    // useful after the programs in it change. Without the link it still
    // sends: the text is the list.
    let text = body;
    if (link) {
      try {
        text = `${link.intro}\n${await getLinkUrl()}\n\n${body}`;
      } catch {
        // Send the snapshot alone.
      }
    }
    window.location.href = mailtoUrl(email, subject, text);
    onClose();
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(copy.text);
    } catch {
      // Clipboard access can be refused (permissions, insecure origin). The
      // text is on screen already; say so rather than opening a prompt.
      setCopyFailed(true);
      return;
    }
    show({ title: `${copy.label} copied` });
    onClose();
  }

  // z-[70]: over the event dialog it opens from, which EventDetailModal
  // lifts to z-[60] above the feed chrome. At Modal's own z-30 it opened
  // behind it, and Share looked like it did nothing.
  return createPortal(
    <div className="relative z-[70]">
      <Modal title={title} size="form" onClose={onClose}>
        <form onSubmit={(e) => void send(e)} className="mt-6 flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <TextField
              label="Share by Email"
              type="email"
              required
              autoComplete="email"
              placeholder="Enter Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              trailingIcon={<Send />}
            >
              Send
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-lg font-medium text-fg">{copy.label}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <p className="max-h-32 min-w-0 flex-1 select-text overflow-y-auto whitespace-pre-line break-words rounded-field border border-line bg-surface-subtle px-4 py-3 text-lg text-fg-muted">
                {copy.text}
              </p>
              <Button
                size="lg"
                onClick={() => void copyText()}
                trailingIcon={<Copy />}
                className="shrink-0"
              >
                Copy
              </Button>
            </div>
            {copyFailed && (
              <p role="alert" className="text-base text-danger-fg">
                Copy didn&apos;t work here — select the text and copy it.
              </p>
            )}
          </div>

          {link && (
            <div className="flex flex-col gap-2">
              <p className="text-lg font-medium text-fg">{link.label}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <p
                  className={`min-w-0 flex-1 rounded-field border border-line bg-surface-subtle px-4 py-3 text-lg ${
                    linkUrl ? "select-text break-all text-fg" : "text-fg-muted"
                  }`}
                >
                  {linkUrl ?? link.note}
                </p>
                <Button
                  size="lg"
                  onClick={() => void copyLink()}
                  trailingIcon={<Link2 />}
                  className="shrink-0"
                >
                  Copy link
                </Button>
              </div>
              {linkError && (
                <p role="alert" className="text-base text-danger-fg">
                  {linkError}
                </p>
              )}
            </div>
          )}
        </form>
      </Modal>
    </div>,
    document.body,
  );
}
