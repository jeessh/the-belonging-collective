"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusPage } from "@/components/StatusPage";
import { Button, buttonClass } from "@/components/ui/Button";

// Anything that throws while a page renders lands here instead of Next's
// bare "Application error". It says which of the likely causes it was —
// no connection, the server out of reach, or a fault on our side — and what
// to do next, with a short code to quote when it keeps happening (the
// digest Next logs on the server with the real error).
function cause(error: Error): "offline" | "server" | "page" {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  const m = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (/failed to fetch|fetch failed|networkerror|load failed|econnrefused|502|503|504/.test(m)) {
    return "server";
  }
  return "page";
}

const COPY = {
  offline: {
    title: "You're offline",
    message: "This page needs the internet. Check your Wi-Fi or data connection, then try again.",
  },
  server: {
    title: "We couldn't reach the server",
    message:
      "The Belonging Collective isn't answering right now. It's usually back within a few minutes, so please try again shortly.",
  },
  page: {
    title: "This page didn't load",
    message:
      "Something broke on our side while opening this page. It isn't anything you did. Try again, or go back to all events.",
  },
} as const;

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Read after mount: navigator isn't there on the server.
  const [kind, setKind] = useState<"offline" | "server" | "page">("page");
  useEffect(() => {
    setKind(cause(error));
    console.error(error);
  }, [error]);
  const copy = COPY[kind];
  return (
    <StatusPage
      title={copy.title}
      message={
        <>
          {copy.message}
          {error?.digest && kind === "page" && (
            <span className="mt-3 block text-base text-fg-muted">
              If it keeps happening, tell your organizer and mention code{" "}
              <span className="font-mono text-fg">{error.digest}</span>.
            </span>
          )}
        </>
      }
      actions={
        <>
          <Button variant="primary" size="lg" onClick={reset}>
            Try again
          </Button>
          <Link href="/" className={buttonClass("secondary", "lg")}>
            See all events
          </Link>
        </>
      }
    />
  );
}
