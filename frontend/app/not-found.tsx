import type { Metadata } from "next";
import Link from "next/link";
import { StatusPage } from "@/components/StatusPage";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <StatusPage
      title="We couldn't find that page"
      message="The link may be old, or the program may have ended."
      actions={
        <Link href="/" className={buttonClass("primary", "lg")}>
          See all programs
        </Link>
      }
    />
  );
}
