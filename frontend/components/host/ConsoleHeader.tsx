"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, Image as ImageIcon, LogOut } from "lucide-react";
import { apiMessage, logout, updateMyOrg, type HostMe } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ImageDrop } from "@/components/ImageDrop";
import { Modal } from "@/components/Modal";
import { Brand } from "@/components/Brand";

/**
 * The bar across the top of every console page: the brand on the left, the
 * signed-in account on the right. The sections live in the side panel
 * (`ConsoleNav`); the account button opens a small menu with the
 * organization's own page (`/o/{slug}`), its logo and Sign out.
 */
export function ConsoleHeader({
  me,
  isSuper,
  onLogoChanged,
}: {
  me: HostMe;
  isSuper: boolean;
  onLogoChanged: (url: string | null) => void;
}) {
  const router = useRouter();
  const [editingLogo, setEditingLogo] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const org = me.org;
  const role = me.is_staff
    ? `${org.name}${isSuper ? " · Super admin" : ""}`
    : isSuper
      ? "Super admin"
      : "Admin";

  // Closes on a click elsewhere or Escape, and Escape hands focus back.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-surface">
      <div className="flex h-[72px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/host/events"
          className="inline-flex min-w-0 items-center gap-3 rounded-control py-1 text-fg [&_img]:h-8 [&>span:last-child]:truncate [&>span:last-child]:text-lg"
        >
          <Brand />
        </Link>

        <div ref={menuRef} className="relative shrink-0">
          <button
            ref={buttonRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex min-h-11 items-center gap-3 rounded-control px-2 text-left hover:bg-surface-subtle"
          >
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logo_url}
                alt=""
                className="size-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <Avatar name={org.name} size={32} />
            )}
            {/* A staff login is a person at the organization: their name
                first, the organization under it. */}
            <span className="flex min-w-0 flex-col leading-tight max-sm:sr-only">
              <span className="truncate text-sm font-medium text-fg">{me.name}</span>
              <span className="truncate text-xs text-fg-muted">{role}</span>
            </span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-fg-icon" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="Account"
              className="absolute right-0 top-full z-40 mt-2 w-56 rounded-control border border-line bg-surface p-1 shadow-lift"
            >
              {org.slug && (
                // The page to send their members to: their programs only.
                <a
                  role="menuitem"
                  href={`/o/${org.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-10 w-full items-center gap-3 rounded-control px-3 text-left text-sm text-fg hover:bg-surface-subtle"
                >
                  <ExternalLink aria-hidden="true" className="size-4" />
                  Your organization&apos;s page
                </a>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setEditingLogo(true);
                }}
                className="flex min-h-10 w-full items-center gap-3 rounded-control px-3 text-left text-sm text-fg hover:bg-surface-subtle"
              >
                <ImageIcon aria-hidden="true" className="size-4" />
                Change logo
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  void logout("host")
                    .catch(() => {})
                    .then(() => router.replace("/host"));
                }}
                className="flex min-h-10 w-full items-center gap-3 rounded-control px-3 text-left text-sm text-fg hover:bg-surface-subtle"
              >
                <LogOut aria-hidden="true" className="size-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {editingLogo && (
        <LogoModal
          value={org.logo_url ?? ""}
          organization={org.name}
          onSaved={(url) => {
            onLogoChanged(url || null);
            setEditingLogo(false);
          }}
          onClose={() => setEditingLogo(false)}
        />
      )}
    </header>
  );
}

/** Setting your own organization's logo. Same uploader as the event form. */
function LogoModal({
  value,
  organization,
  onSaved,
  onClose,
}: {
  value: string;
  organization: string;
  onSaved: (url: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateMyOrg({ logo_url: url || null });
      onSaved(url);
    } catch (e) {
      setError(apiMessage(e, "Couldn't save that logo. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal title="Your organization's logo" onClose={onClose}>
      <p className="mt-2 text-lg text-fg-muted">
        Members see it next to {organization}&apos;s programs in the feed. A
        square image works best.
      </p>
      <div className="mt-4">
        <ImageDrop label="Logo" sizing="logo" value={url} onChange={setUrl} />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-base text-danger-fg">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save logo"}
        </Button>
      </div>
    </Modal>
  );
}
