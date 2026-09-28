"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Lock, LogOut, Users } from "lucide-react";
import { apiMessage, logout, updateMyOrg, type HostMe } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClass } from "@/components/ui/Button";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { ImageDrop } from "@/components/ImageDrop";
import { Modal } from "@/components/Modal";
import { Brand } from "@/components/Brand";

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
  me,
  isSuper,
  pendingAccess = 0,
  onLogoChanged,
}: {
  me: HostMe;
  isSuper: boolean;
  /** Special-access requests waiting — the badge on that entry. */
  pendingAccess?: number;
  onLogoChanged: (url: string | null) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [editingLogo, setEditingLogo] = useState(false);
  const org = me.org;

  const area: Area =
    pathname.startsWith("/host/admins") ||
    pathname.startsWith("/host/users") ||
    pathname.startsWith("/host/topics")
      ? "accounts"
      : "events";
  const onAccess = pathname.startsWith("/host/access");
  const onTeam = pathname.startsWith("/host/team");
  const onAnalytics = pathname.startsWith("/host/analytics");
  // The three per-organization pages share one look; the label goes when
  // there's no room for it, the icon and any badge stay.
  const navClass = (on: boolean) =>
    buttonClass("ghost", "md", on ? "bg-surface-subtle" : "");
  const labelClass = isSuper ? "max-2xl:sr-only" : "max-md:sr-only";

  return (
    <header className="no-print border-b border-line bg-surface">
      <div className="mx-auto flex min-h-[92px] w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-9">
        <Link
          href="/host/events"
          className="inline-flex items-center gap-3 rounded-control py-1 text-fg"
        >
          <Brand />
        </Link>

        {/* Below `lg` the switch takes its own row under the name and the
            way out, which fit together on one; the design's single row needs
            the desktop width. */}
        {isSuper && (
          <SegmentedToggle<Area>
            label="Console area"
            className="order-last w-full justify-center sm:w-auto lg:order-none"
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

        <div className="flex min-w-0 items-center gap-1 sm:gap-3">
          <Link
            href="/host/analytics"
            title="Analytics"
            aria-current={onAnalytics ? "page" : undefined}
            className={navClass(onAnalytics)}
          >
            <BarChart3 aria-hidden="true" className="size-6 shrink-0" />
            <span className={labelClass}>Analytics</span>
          </Link>
          <Link
            href="/host/team"
            title="Team"
            aria-current={onTeam ? "page" : undefined}
            className={navClass(onTeam)}
          >
            <Users aria-hidden="true" className="size-6 shrink-0" />
            <span className={labelClass}>Team</span>
          </Link>
          {/* Every organizer has this: it is where requests to join their
              special-access groups wait. The badge is the count waiting. */}
          <Link
            href="/host/access"
            title="Special access"
            aria-current={onAccess ? "page" : undefined}
            className={navClass(onAccess)}
          >
            <Lock aria-hidden="true" className="size-6 shrink-0" />
            <span className={labelClass}>Special access</span>
            {pendingAccess > 0 && (
              <span className="grid h-7 min-w-7 place-items-center rounded-full bg-primary px-2 text-base font-medium text-fg">
                {pendingAccess}
                <span className="sr-only">
                  {" "}
                  {pendingAccess === 1 ? "request" : "requests"} waiting
                </span>
              </span>
            )}
          </Link>
          {/* The logo is the organization's own to set — members recognise
              them by it in the feed. */}
          <button
            type="button"
            onClick={() => setEditingLogo(true)}
            title="Change your organization's logo"
            className="inline-flex min-h-11 min-w-0 items-center gap-3 rounded-control px-1 text-left hover:bg-surface-subtle"
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
            <span className="flex min-w-0 flex-col leading-tight text-fg-muted">
              {/* A staff login is a person at the organization: their name
                  first, the organization under it. The shared login is the
                  organization itself. */}
              <span className="truncate text-lg font-bold">{me.name}</span>
              <span className="hidden truncate text-base sm:block">
                {me.is_staff
                  ? `${org.name}${isSuper ? " · Super admin" : ""}`
                  : isSuper
                    ? "Super admin"
                    : "Admin"}
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
