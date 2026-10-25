"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  fetchAccessGroups,
  getHostMe,
  getSession,
  type HostMe,
  type Session,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ConsoleHeader } from "@/components/host/ConsoleHeader";
import { ConsoleNav } from "@/components/host/ConsoleNav";

/**
 * Chrome for the admin console: a slim top bar (brand, account), the
 * sections in a side panel (a scrolling row on narrow screens), and the page.
 *
 * Resolves the session and the organizer's own account before rendering
 * anything, so a page never flashes superadmin-only content at a plain admin
 * and the header never shows an empty name.
 */

export type ConsoleContext = {
  session: Session;
  /** The signed-in login: the organization's own, or one of its staff. */
  me: HostMe;
  /**
   * The organization the login acts for. Programs and groups are owned by
   * this id, so ownership comparisons read it — never `session.id`, which is
   * the person's login when they're staff.
   */
  org: HostMe["org"];
  isSuper: boolean;
  /** Special-access requests waiting on this organizer — the header badge. */
  pendingAccess: number;
  /** Re-count after a decision, so the badge doesn't wait for a reload. */
  refreshPendingAccess: () => void;
};

/**
 * The login page, carrying the page to come back to. Used whenever a console
 * request answers 401: the session ended, and the login page says so (it
 * shows the notice whenever `next` is present).
 */
export function loginAgainHref(): string {
  const here = window.location.pathname + window.location.search;
  return `/host?next=${encodeURIComponent(here)}`;
}

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
    Promise.all([getSession(), getHostMe()])
      .then(([session, me]) => {
        if (!alive) return;
        if (!session.authenticated || session.role !== "host") {
          router.replace(loginAgainHref());
          return;
        }
        setCtx({ session, me, org: me.org, isSuper: me.is_admin });
      })
      .catch((e) => {
        if (!alive) return;
        // A 401 means "not signed in" → front door. A network blip shouldn't
        // eject someone mid-task, so offer a retry instead.
        if (e instanceof ApiError && e.status === 401) router.replace(loginAgainHref());
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
    // `.console` (globals.css): the console's smaller type and control
    // scale, for everything on the page and nowhere else.
    <div className="console min-h-dvh bg-surface text-fg">
      <ConsoleHeader
        me={ctx.me}
        isSuper={ctx.isSuper}
        onLogoChanged={(logo_url) =>
          setCtx({
            ...ctx,
            org: { ...ctx.org, logo_url },
            me: { ...ctx.me, org: { ...ctx.me.org, logo_url } },
          })
        }
      />
      <div className="lg:flex">
      <ConsoleNav isSuper={ctx.isSuper} pendingAccess={pendingAccess} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-9">
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
