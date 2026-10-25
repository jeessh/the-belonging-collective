"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Lock,
  Tags,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * The console's sections, Event Management first — it is where every
 * organizer lands after signing in. A side panel from `lg`; under it, the same links
 * as one scrolling row beneath the top bar.
 *
 * The last three (organizations, community members, topics) are a
 * superadmin's only — those pages refuse anyone else, so the links would only
 * lead to "Not available".
 */

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Paths that count as being in this section. */
  match: string[];
  superOnly?: boolean;
};

const ITEMS: Item[] = [
  { href: "/host/events", label: "Event Management", icon: CalendarDays, match: ["/host/events"] },
  { href: "/host/analytics", label: "Analytics", icon: BarChart3, match: ["/host/analytics"] },
  { href: "/host/team", label: "Team", icon: Users, match: ["/host/team"] },
  { href: "/host/access", label: "Special Access", icon: Lock, match: ["/host/access"] },
  // The platform-wide pages: superadmins only.
  {
    href: "/host/admins",
    label: "Organization Management",
    icon: Building2,
    match: ["/host/admins"],
    superOnly: true,
  },
  {
    href: "/host/users",
    label: "Community Member Management",
    icon: UserCog,
    match: ["/host/users", "/host/members"],
    superOnly: true,
  },
  { href: "/host/topics", label: "Topics", icon: Tags, match: ["/host/topics"], superOnly: true },
];

export function ConsoleNav({
  isSuper,
  pendingAccess = 0,
}: {
  isSuper: boolean;
  /** Special-access requests waiting — the badge on that entry. */
  pendingAccess?: number;
}) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => isSuper || !i.superOnly);
  // On a narrow screen the row scrolls sideways: bring the current section
  // into view, or the last one in the list opens off the edge.
  const currentRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const row = currentRef.current?.closest("ul");
    const link = currentRef.current;
    if (!row || !link || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = link.offsetLeft - (row.clientWidth - link.offsetWidth) / 2;
  }, [pathname]);

  return (
    <nav
      aria-label="Console"
      className="no-print border-line bg-surface max-lg:border-b lg:sticky lg:top-[73px] lg:h-[calc(100dvh-73px)] lg:w-64 lg:shrink-0 lg:border-r"
    >
      <ul className="flex gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:flex-col lg:overflow-visible lg:px-3 lg:py-4">
        {items.map(({ href, label, icon: Icon, match }) => {
          const on = match.some((m) => pathname.startsWith(m));
          const badge = href === "/host/access" && pendingAccess > 0;
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                ref={on ? currentRef : undefined}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-10 items-center gap-3 whitespace-nowrap rounded-control px-3 text-sm transition-colors ${
                  on
                    ? "bg-primary-soft font-medium text-fg"
                    : "text-fg-muted hover:bg-surface-subtle hover:text-fg"
                }`}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-medium text-fg">
                    {pendingAccess}
                    <span className="sr-only">
                      {" "}
                      {pendingAccess === 1 ? "request" : "requests"} waiting
                    </span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
