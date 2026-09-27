"use client";

import { usePathname, useRouter } from "next/navigation";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";

type Tab = "organizations" | "members";

const HREF: Record<Tab, string> = {
  organizations: "/host/admins",
  members: "/host/users",
};

/**
 * The two kinds of account a superadmin manages. Organizers and community
 * members are different enough that one table would have to hedge on every
 * column — one has an email and an access level, the other a sign-in key.
 */
export function AccountsNav() {
  const pathname = usePathname();
  const router = useRouter();
  const tab: Tab = pathname.startsWith("/host/users") ? "members" : "organizations";
  return (
    <SegmentedToggle<Tab>
      label="Account type"
      value={tab}
      onChange={(next) => {
        if (next !== tab) router.push(HREF[next]);
      }}
      segments={[
        { value: "organizations", label: "Organizations" },
        { value: "members", label: "Community Members" },
      ]}
    />
  );
}
