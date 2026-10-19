"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, apiMessage } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { AuthPage } from "@/components/host/AuthPage";

// Sign-in only. There is no self-serve organizer registration: a superadmin
// creates accounts from Admin console → Admins. Anyone being able to register
// meant anyone could publish programs to the member feed.
export default function HostAuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Where a 401 elsewhere in the console sent them from (AdminShell's
  // loginAgainHref). Read once on mount: useSearchParams would need a
  // Suspense boundary for a page that is otherwise static.
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    setNext(new URLSearchParams(window.location.search).get("next"));
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("/auth/login/host", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      // Only back into the console — never off to another site.
      router.push(next?.startsWith("/host") ? next : "/host/events");
    } catch (e) {
      if (!(e instanceof ApiError)) {
        setError("Couldn't reach the server. Please try again.");
      } else if (e.status === 401) {
        setError("Wrong email or password.");
      } else if (e.status === 422) {
        setError("Enter a valid email and password.");
      } else {
        // 429 (too many tries) and the like carry their own explanation.
        setError(apiMessage(e, "Couldn't log in. Please try again."));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPage title="Login to the admin console">
      {next && (
        <p role="status" className="text-lg text-fg">
          Your session ended. Please log in again.
        </p>
      )}
      <form
        className="flex flex-col gap-6"
        // Our own messages, not the browser's bubbles.
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && email && password) void submit();
        }}
      >
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p role="alert" className="text-lg text-danger-fg">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="mt-4"
          disabled={busy || !email || !password}
        >
          {busy ? "Logging in…" : "Login"}
        </Button>
      </form>

      <div className="flex flex-col gap-3 text-lg">
        <Link
          href="/host/forgot"
          className="w-fit text-fg underline underline-offset-4"
        >
          Forgot your password?
        </Link>
        <p className="text-fg-muted">
          Need an account? Ask a superadmin at your organization to create one.
        </p>
      </div>
    </AuthPage>
  );
}
