"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiMessage, updateMe } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { Button } from "@/components/ui/Button";
import { MemberAuthFlow } from "@/components/member/MemberAuthFlow";

/**
 * A same-origin path from `?next=`, or the feed.
 *
 * Resolved against our own origin and compared, rather than prefix-checked:
 * `"/\\evil.com"` starts with a single "/" but the URL parser treats the
 * backslash as a separator, so it resolves to `https://evil.com` — and Next's
 * router does a real cross-origin navigation for it. Only the path, query and
 * hash of a URL that stayed on our origin survive.
 *
 * `save=1` is the pending save from the program page; a guest has no account
 * to complete it with, so it is dropped rather than resumed into a 401.
 */
function safeNext(raw: string | null, { asGuest = false } = {}): string {
  if (!raw) return "/";
  try {
    const here = new URL(window.location.href);
    const target = new URL(raw, here.origin);
    if (target.origin !== here.origin) return "/";
    if (asGuest) target.searchParams.delete("save");
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupFlow />
    </Suspense>
  );
}

/**
 * The full-page door, for arrivals from a program page. The same flow as the
 * in-feed overlay; a new account then picks its topics before going on.
 */
function SignupFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const [phase, setPhase] = useState<"auth" | "topics">("auth");
  // Topics this person wants to see first. Optional — an empty list just means
  // the feed keeps its default order.
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolved at the moment of leaving rather than at render: safeNext reads
  // window.location, which doesn't exist during the server pass.
  function leave(asGuest = false) {
    router.replace(safeNext(params.get("next"), { asGuest }));
  }

  function toggleInterest(label: string) {
    setInterests((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
    );
  }

  async function saveInterests() {
    setBusy(true);
    setError(null);
    try {
      await updateMe({ interest_categories: interests });
      leave();
    } catch (e) {
      setError(apiMessage(e, "That didn't save. Please try again."));
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-subtle px-4 py-8">
      <section className="w-full max-w-lg rounded-card border border-line bg-surface p-6 shadow-lift sm:p-10">
        {phase === "auth" ? (
          <MemberAuthFlow
            onSignedIn={({ mode }) =>
              mode === "signup" ? setPhase("topics") : leave()
            }
            onGuest={() => leave(true)}
          >
            {(view) => (
              <>
                {view.icon}
                <h1 className="text-2xl font-medium text-fg sm:text-3xl">
                  {view.title}
                </h1>
                {view.subtitle && (
                  <p className="mt-2 text-lg text-fg-muted">{view.subtitle}</p>
                )}
                {view.body}
              </>
            )}
          </MemberAuthFlow>
        ) : (
          <>
            <h1 className="text-2xl font-medium text-fg sm:text-3xl">
              What do you like?
            </h1>
            <p className="mt-2 text-lg text-fg-muted">
              Pick any. You can change this later.
            </p>

            <div
              role="group"
              aria-label="Topics you are interested in"
              className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3"
            >
              {CATEGORIES.map(({ label, emoji }) => {
                const chosen = interests.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleInterest(label)}
                    aria-pressed={chosen}
                    className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-control border-2 p-3 text-center transition-colors ${
                      chosen
                        ? "border-primary-border bg-primary-soft"
                        : "border-line bg-surface hover:bg-surface-subtle"
                    }`}
                  >
                    <span className="text-3xl" aria-hidden="true">
                      {emoji}
                    </span>
                    <span className="text-base font-medium text-fg">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="sr-only" role="status" aria-live="polite">
              {interests.length === 0
                ? "Nothing chosen yet"
                : `${interests.length} chosen: ${interests.join(", ")}`}
            </p>

            {error && (
              <p role="alert" className="mt-4 text-lg font-medium text-danger-fg">
                {error}
              </p>
            )}

            <div className="mt-8 flex gap-4">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                disabled={busy}
                onClick={() => leave()}
              >
                Skip
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                disabled={busy}
                onClick={() => void saveInterests()}
              >
                Continue
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
