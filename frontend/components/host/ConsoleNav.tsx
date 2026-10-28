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
 * The console's sections: Organization Management first for a superadmin,
 * then Event Management — where every organizer lands after signing in —
 * with Analytics and Topics as its sub tabs, and Special Access under
 * Member Management. A side panel from `lg`, the sub tabs indented under
 * their parent; under `lg`, the same links (sub tabs included) as one
 * scrolling row beneath the top bar.
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
}: {
  isSuper: boolean;
  /** Special-access requests waiting — the badge on that entry. */
  pendingAccess?: number;
}) {
  const pathname = usePathname();
  const visible = (i: Item) => isSuper || !i.superOnly;
  // A sub tab whose parent this person can't see (Special Access, for an
  // ordinary organization) stands on its own in the parent's place.
  const items = ITEMS.flatMap((i) =>
    visible(i) ? [i] : (i.children ?? []).filter(visible),
  );
  // On a narrow screen the row scrolls sideways: bring the current section
  // into view, or the last one in the list opens off the edge.
  const currentRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const row = currentRef.current?.closest("nav > ul");
    const link = currentRef.current;
    if (!row || !link || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = link.offsetLeft - (row.clientWidth - link.offsetWidth) / 2;
  }, [pathname]);

  const link = ({ href, label, icon: Icon, match }: Item, sub = false) => {
    const on = match.some((m) => pathname.startsWith(m));
    const badge = href === "/host/access" && pendingAccess > 0;
    return (
      <Link
        href={href}
        ref={on ? currentRef : undefined}
        aria-current={on ? "page" : undefined}
        className={`flex min-h-10 items-center gap-3 whitespace-nowrap rounded-control px-3 text-sm transition-colors ${
          sub ? "lg:min-h-9" : ""
        } ${
          on
            ? "bg-primary-soft font-medium text-fg"
            : "text-fg-muted hover:bg-surface-subtle hover:text-fg"
        }`}
      >
        <Icon aria-hidden="true" className={`${sub ? "size-4" : "size-5"} shrink-0`} />
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
        {items.map((item) => {
          const subs = item.children?.filter(visible) ?? [];
          return (
            // `contents` below lg: the sub tabs join the scrolling row as
            // equals; from lg they nest under their parent, indented.
            <li key={item.href} className="shrink-0 max-lg:contents">
              {link(item)}
              {subs.length > 0 && (
                <ul
                  aria-label={`${item.label} sections`}
                  className="flex gap-1 max-lg:contents lg:mt-1 lg:flex-col lg:border-l lg:border-line lg:ml-[21px] lg:pl-2"
                >
                  {subs.map((sub) => (
                    <li key={sub.href} className="shrink-0">
                      {link(sub, true)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
