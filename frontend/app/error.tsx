"use client";

import Link from "next/link";
import { StatusPage } from "@/components/StatusPage";
import { Button, buttonClass } from "@/components/ui/Button";

// Anything that throws while a page renders — usually the backend being
// unreachable for a server-rendered page — lands here instead of Next's
// bare "Application error".
export default function Error({ reset }: { reset: () => void }) {
  return (
    <StatusPage
      title="Something went wrong"
      message="We couldn't load this page. Please try again in a moment."
      actions={
        <>
          <Button variant="primary" size="lg" onClick={reset}>
            Try again
          </Button>
          <Link href="/" className={buttonClass("secondary", "lg")}>
            See all programs
          </Link>
        </>
      }
    />
  );
}
