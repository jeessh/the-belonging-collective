"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  api,
  fetchAccessGroups,
  getSession,
  type AdminAccount,
  type Session,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ConsoleHeader } from "@/components/host/ConsoleHeader";

/**
 * Chrome for the admin console: the header bar, over a page.
 *
 * Resolves the session and the organizer's own account before rendering
 * anything, so a page never flashes superadmin-only content at a plain admin
 * and the header never shows an empty name.
 */

export type ConsoleContext = {
  session: Session;
  /** The signed-in organization (`/hosts/me`). */
  org: AdminAccount;
  isSuper: boolean;
  /** Special-access requests waiting on this organizer — the header badge. */
  pendingAccess: number;
  /** Re-count after a decision, so the badge doesn't wait for a reload. */
  refreshPendingAccess: () => void;
};

export function AdminShell({
  requireSuperadmin = false,
  children,
}: {
  /** Gate the whole page, not just the nav entry. The API refuses regardless. */
  requireSuperadmin?: boolean;
  children: (ctx: ConsoleContext) => ReactNode;
}) {
  const router = useRouter();
  const [ctx, setCtx] = useState<Omit<
    ConsoleContext,
    "pendingAccess" | "refreshPendingAccess"
  > | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pendingAccess, setPendingAccess] = useState(0);

  // A missing count is not worth blocking the console for.
  const refreshPendingAccess = useCallback(() => {
    fetchAccessGroups()
      .then((groups) =>
        setPendingAccess(groups.reduce((n, g) => n + g.pending_count, 0)),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    Promise.all([getSession(), api<AdminAccount>("/hosts/me")])
      .then(([session, org]) => {
        if (!alive) return;
        if (!session.authenticated || session.role !== "host") {
          router.replace("/host");
          return;
        }
        setCtx({ session, org, isSuper: !!session.is_admin });
      })
      .catch((e) => {
        if (!alive) return;
        // A 401 means "not signed in" → front door. A network blip shouldn't
        // eject someone mid-task, so offer a retry instead.
        if (e instanceof ApiError && e.status === 401) router.replace("/host");
        else setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [router, attempt]);

  // Each console page mounts its own shell, so this runs once per page.
  useEffect(() => {
    if (ctx) refreshPendingAccess();
  }, [ctx, refreshPendingAccess]);

  if (failed) {
    return (
      <Centered>
        <p className="text-xl text-fg">Couldn&apos;t reach the server.</p>
        <Button className="mt-4" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </Button>
      </Centered>
    );
  }

  if (!ctx) {
    return (
      <Centered>
        <p className="text-lg text-fg-muted">Loading…</p>
      </Centered>
    );
  }

  const full: ConsoleContext = { ...ctx, pendingAccess, refreshPendingAccess };

  return (
    <div className="min-h-dvh bg-surface text-fg">
      <ConsoleHeader
        org={ctx.org}
        isSuper={ctx.isSuper}
        pendingAccess={pendingAccess}
        onLogoChanged={(logo_url) =>
          setCtx({ ...ctx, org: { ...ctx.org, logo_url } })
        }
      />
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-9">
        {requireSuperadmin && !ctx.isSuper ? (
          <div className="py-16 text-center">
            <h1 className="text-3xl font-medium text-fg">Not available</h1>
            <p className="mt-3 text-lg text-fg-muted">
              Only a superadmin can open this page. Ask KW Habilitation if you
              need access.
            </p>
          </div>
        ) : (
          children(full)
        )}
      </main>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface text-center">
      <div>{children}</div>
    </main>
  );
}
