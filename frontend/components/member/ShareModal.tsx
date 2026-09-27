"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Copy, Send } from "lucide-react";
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
  onClose,
}: {
  title: string;
  subject: string;
  body: string;
  /** What Copy copies, and how the row is labelled. */
  copy: { label: string; text: string };
  onClose: () => void;
}) {
  const { show } = useToast();
  const [email, setEmail] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);

  function send(e: FormEvent) {
    e.preventDefault();
    window.location.href = mailtoUrl(email, subject, body);
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

  return createPortal(
    <Modal title={title} onClose={onClose}>
      <form onSubmit={send} className="mt-6 flex flex-col gap-6">
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

        <div className="flex flex-col gap-1">
          <p className="text-lg font-medium text-fg">{copy.label}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <p className="line-clamp-2 flex-1 select-text break-all rounded-field border border-line bg-surface-subtle px-4 py-3 text-lg text-fg-muted">
              {copy.text}
            </p>
            <Button
              size="lg"
              onClick={() => void copyText()}
              trailingIcon={<Copy />}
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
      </form>
    </Modal>,
    document.body,
  );
}
