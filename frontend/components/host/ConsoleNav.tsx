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
 * The console's pages: Organization Management first for a superadmin,
 * then Event Management — where every organizer lands after signing in —
 * with Analytics and Topics after it, Member Management with Special
 * Access, then the team. One flat list: every entry is a page, the same
 * size, none indented — an indented list read as section headings over
 * their pages, and staff didn't realise the top ones were pages too
 * (client feedback). Related pages are grouped by a thin divider from `lg`;
 * under `lg`, the same links as one scrolling row beneath the top bar.
 *
 * Organization Management, Member Management and Topics are a
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
  /** Sub tabs, listed indented under this one. */
  children?: Item[];
};

const ITEMS: Item[] = [
  // A superadmin's first tab; nobody else sees it.
  {
    href: "/host/admins",
    label: "Organization Management",
    icon: Building2,
    match: ["/host/admins"],
    superOnly: true,
  },
  {
    href: "/host/events",
    label: "Event Management",
    icon: CalendarDays,
    match: ["/host/events"],
    children: [
      { href: "/host/analytics", label: "Analytics", icon: BarChart3, match: ["/host/analytics"] },
      {
        href: "/host/topics",
        label: "Topics",
        icon: Tags,
        match: ["/host/topics"],
        superOnly: true,
      },
    ],
  },
  {
    href: "/host/users",
    label: "Member Management",
    icon: UserCog,
    match: ["/host/users", "/host/members"],
    superOnly: true,
    children: [
      { href: "/host/access", label: "Special Access", icon: Lock, match: ["/host/access"] },
    ],
  },
  { href: "/host/team", label: "Team", icon: Users, match: ["/host/team"] },
];

export function ConsoleNav({
  isSuper,
  pendingAccess = 0,
  teamLabel,
}: {
  isSuper: boolean;
  /** The Team entry is named after the organization ("Karis Disability
      Services team"). */
  teamLabel?: string;
  /** Special-access requests waiting — the badge on that entry. */
  pendingAccess?: number;
}) {
  const pathname = usePathname();
  const visible = (i: Item) => isSuper || !i.superOnly;
  // A sub tab whose parent this person can't see (Special Access, for an
  // ordinary organization) stands on its own in the parent's place.
  const items = ITEMS.flatMap((i) =>
    visible(i) ? [i] : (i.children ?? []).filter(visible),
  ).map((i) => (i.href === "/host/team" && teamLabel ? { ...i, label: teamLabel } : i));
  // On a narrow screen the row scrolls sideways: bring the current section
  // into view, or the last one in the list opens off the edge.
  const currentRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const row = currentRef.current?.closest("nav > ul");
    const link = currentRef.current;
    if (!row || !link || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = link.offsetLeft - (row.clientWidth - link.offsetWidth) / 2;
  }, [pathname]);

  const link = ({ href, label, icon: Icon, match }: Item) => {
    const on = match.some((m) => pathname.startsWith(m));
    const badge = href === "/host/access" && pendingAccess > 0;
    return (
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
    );
  };

  return (
    <nav
      aria-label="Console"
      className="no-print border-line bg-surface max-lg:border-b lg:sticky lg:top-[73px] lg:h-[calc(100dvh-73px)] lg:w-64 lg:shrink-0 lg:border-r"
    >
      <ul className="flex gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:flex-col lg:overflow-visible lg:px-3 lg:py-4">
        {items.map((item, g) => {
          const group = [item, ...(item.children?.filter(visible) ?? [])];
          return group.map((page, i) => (
            <li
              key={page.href}
              // A thin rule between groups of related pages (side panel only).
              className={`shrink-0 ${
                g > 0 && i === 0 ? "lg:mt-2 lg:border-t lg:border-line lg:pt-2" : ""
              }`}
            >
              {link(page)}
            </li>
          ));
        })}
      </ul>
    </nav>
  );
}
