"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { apiMessage, logout, updateMyOrg, type AdminAccount } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { ImageDrop } from "@/components/ImageDrop";
import { Modal } from "@/components/Modal";

/**
 * The bar every console page shares: who you are, the way out, and — for
 * superadmins — the switch between managing events and managing accounts.
 */

type Area = "events" | "accounts";

const AREA_HOME: Record<Area, string> = {
  events: "/host/events",
  accounts: "/host/admins",
};

export function ConsoleHeader({
  org,
  isSuper,
  onLogoChanged,
}: {
  org: AdminAccount;
  isSuper: boolean;
  onLogoChanged: (url: string | null) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [editingLogo, setEditingLogo] = useState(false);

  const area: Area =
    pathname.startsWith("/host/admins") || pathname.startsWith("/host/users")
      ? "accounts"
      : "events";

  return (
    <header className="no-print border-b border-line bg-surface">
      <div className="mx-auto flex min-h-[92px] w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-9">
        <Link
          href="/host/events"
          className="inline-flex items-center gap-3 rounded-control py-1 text-fg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="size-11 rounded-control" />
          <span className="text-xl font-medium leading-tight sm:text-2xl">
            The Belonging Collective
          </span>
        </Link>

        {isSuper && (
          <SegmentedToggle<Area>
            label="Console area"
            className="order-last w-full justify-center sm:order-none sm:w-auto"
            value={area}
            onChange={(next) => {
              if (next !== area) router.push(AREA_HOME[next]);
            }}
            segments={[
              { value: "accounts", label: "Account Management" },
              { value: "events", label: "Event Management" },
            ]}
          />
        )}

        <div className="flex items-center gap-4">
          {/* The logo is the organization's own to set — members recognise
              them by it in the feed. */}
          <button
            type="button"
            onClick={() => setEditingLogo(true)}
            title="Change your organization's logo"
            className="inline-flex min-h-11 items-center gap-3 rounded-control px-1 text-left hover:bg-surface-subtle"
          >
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logo_url}
                alt=""
                className="size-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <Avatar name={org.name} size={36} />
            )}
            <span className="flex flex-col leading-tight text-fg-muted">
              <span className="text-lg font-bold">{org.name}</span>
              <span className="text-base">
                {isSuper ? "Super admin" : "Admin"}
              </span>
            </span>
          </button>
          <Button
            variant="ghost"
            leadingIcon={<LogOut />}
            onClick={() => {
              void logout()
                .catch(() => {})
                .then(() => router.replace("/host"));
            }}
          >
            Sign out
          </Button>
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
        This is how members pick {organization} out in the feed. A square
        image works best.
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
