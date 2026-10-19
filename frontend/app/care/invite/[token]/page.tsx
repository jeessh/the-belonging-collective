"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import {
  ApiError,
  acceptCareInvite,
  api,
  apiMessage,
  logout,
  previewCareInvite,
  type CareInvitePreview,
  type Me,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { FormFooter } from "@/components/member/FormFooter";
import { MemberAuthPage } from "@/components/member/MemberAuthPage";

/**
 * A member's invitation to be their caregiver, opened from the email (or a
 * link they passed on by hand). Says who is asking and what accepting means
 * before anything else, then: sign in or sign up with the invited email,
 * accept, linked.
 *
 * Only the account with the invited email can accept — the API refuses
 * anyone else — so a signed-in account with a different email is told so
 * and offered a way to switch, rather than a button that will fail.
 */
export default function CareInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const toast = useToast();
  const [invite, setInvite] = useState<CareInvitePreview | null | undefined>(
    undefined,
  );
  const [problem, setProblem] = useState<string | null>(null);
  // undefined while loading, null when signed out.
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    previewCareInvite(token)
      .then(setInvite)
      .catch((e) => {
        setInvite(null);
        setProblem(apiMessage(e, "That invitation isn't valid any more."));
      });
    api<Me>("/users/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, [token]);

  const here = `/care/invite/${token}`;
  const toSignup = (login: boolean) =>
    router.push(
      `/signup?${login ? "login=1&" : ""}next=${encodeURIComponent(here)}`,
    );

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await acceptCareInvite(token);
      setDone(true);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? "Please log in again to accept."
          : apiMessage(e, "Couldn't accept the invitation. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function switchAccount() {
    try {
      await logout();
    } catch {
      /* signed out either way, as far as this page is concerned */
    }
    setMe(null);
    toast.show({ title: "Logged out", tone: "info" });
  }

  if (invite === undefined || me === undefined) {
    return (
      <MemberAuthPage title="Checking your invitation…">
        <p className="sr-only" role="status">
          Loading
        </p>
      </MemberAuthPage>
    );
  }

  if (invite === null) {
    return (
      <MemberAuthPage title="This invitation can't be used" subtitle={problem}>
        <p className="text-lg text-fg">
          Ask the person who invited you to send a new one.
        </p>
        <FormFooter
          className="mt-10"
          primary={{ label: "Go to events", onClick: () => router.push("/") }}
        />
      </MemberAuthPage>
    );
  }

  if (done) {
    return (
      <MemberAuthPage
        title={`You now support ${invite.member}`}
        subtitle={`Choose "Saving for: ${invite.member}" at the top of the events page to see and save their events.`}
        icon={
          <CircleCheck
            aria-hidden="true"
            strokeWidth={2}
            className="mb-6 size-12 text-toast-success"
          />
        }
      >
        <FormFooter
          secondary={{ label: "My profile", onClick: () => router.push("/profile") }}
          primary={{ label: "Go to events", onClick: () => router.push("/") }}
        />
      </MemberAuthPage>
    );
  }

  const what = (
    <ul className="flex list-disc flex-col gap-2 pl-6 text-lg text-fg">
      <li>You can see the events {invite.member_first_name} has saved.</li>
      <li>You can save events for {invite.member_first_name}.</li>
      <li>
        {invite.member_first_name} keeps their own account, and either of you
        can end this at any time from your profile.
      </li>
    </ul>
  );

  const title = `${invite.member} invited you to be their caregiver`;

  if (me === null) {
    return (
      <MemberAuthPage
        title={title}
        subtitle={`Log in or create an account with ${invite.email} to accept.`}
      >
        {what}
        <FormFooter
          className="mt-10"
          secondary={{ label: "Create an account", onClick: () => toSignup(false) }}
          primary={{ label: "Log in", onClick: () => toSignup(true) }}
        />
      </MemberAuthPage>
    );
  }

  const mismatch = (me.email ?? "").toLowerCase() !== invite.email.toLowerCase();

  if (mismatch) {
    return (
      <MemberAuthPage
        title={title}
        subtitle={`This invitation is for ${invite.email}. You're logged in as ${
          me.email ?? `${me.first_name} ${me.last_name}`
        }.`}
      >
        {what}
        <FormFooter
          className="mt-10"
          secondary={{ label: "Not now", onClick: () => router.push("/") }}
          primary={{
            label: `Log in as ${invite.email}`,
            onClick: () => void switchAccount(),
          }}
        />
      </MemberAuthPage>
    );
  }

  return (
    <MemberAuthPage title={title}>
      {what}
      {error && (
        <p role="alert" className="mt-6 text-lg text-danger-fg">
          {error}
        </p>
      )}
      <FormFooter
        className="mt-10"
        secondary={{ label: "Not now", onClick: () => router.push("/") }}
        primary={{
          label: busy ? "Accepting…" : "Accept",
          disabled: busy,
          onClick: () => void accept(),
        }}
      />
    </MemberAuthPage>
  );
}
