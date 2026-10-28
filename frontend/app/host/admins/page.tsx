"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, SendHorizontal, ShieldCheck, Trash2 } from "lucide-react";
import {
  ApiError,
  apiMessage,
  createInvite,
  deleteAdmin,
  listAdmins,
  listInvites,
  revokeInvite,
  updateAdmin,
  type AdminAccount,
  type HostInvite,
} from "@/lib/api";
import { AdminShell, loginAgainHref, type ConsoleContext } from "@/components/AdminShell";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { copyText } from "@/lib/clipboard";
import { EmptyRow, Pill, TableCard } from "@/components/AdminTable";
import { Modal } from "@/components/Modal";

/**
 * Account Management: every organization with access, and the way to add one.
 *
 * The organization is the account; its staff logins, if it has added any,
 * are listed under it. Removing an organization archives the account, its
 * staff logins and every program it posted, which is why the trash icon
 * leads to a confirmation that says how many.
 */
export default function AdminsPage() {
  return (
    <AdminShell requireSuperadmin>
      {(ctx) => <Accounts ctx={ctx} />}
    </AdminShell>
  );
}

function Accounts({ ctx }: { ctx: ConsoleContext }) {
  const router = useRouter();
  const { show } = useToast();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [invites, setInvites] = useState<HostInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addingSuper, setAddingSuper] = useState(false);
  const [removing, setRemoving] = useState<AdminAccount | null>(null);

  async function load() {
    try {
      const [rows, pending] = await Promise.all([
        listAdmins(),
        listInvites().catch(() => [] as HostInvite[]),
      ]);
      setAdmins(rows);
      setInvites(pending);
      setLoadError(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace(loginAgainHref());
        return;
      }
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-8">

      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-medium text-fg sm:text-4xl">
          Organizations
        </h1>
        <p className="text-xl text-fg">
          Every organization that posts programs on the platform. Each one
          manages its own events, staff and special access. Adding people
          to an organization&apos;s own team happens on its Team page.
        </p>
      </div>

      <InviteForm
        onSent={() => void load()}
      />

      {invites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-medium text-fg">Organization invitations waiting</h2>
          <ul className="flex flex-col divide-y divide-line-active border-t border-line-active">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-xl text-fg"
              >
                <span className="min-w-[200px]">{inv.organization}</span>
                <span className="text-fg-muted">{inv.email}</span>
                <Pill tone={inv.expired ? "warn" : "neutral"}>
                  {inv.expired ? "Expired" : "Pending"}
                </Pill>
                <span className="ml-auto">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void revokeInvite(inv.id).then(() => {
                        show({ title: `Revoked the invite for ${inv.organization}.` });
                        void load();
                      });
                    }}
                  >
                    Revoke
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="-mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-medium text-fg">Organization Admins</h2>
        {/* Rare and powerful, so its own button and form rather than a box
            to tick on every agency's invitation. */}
        <Button
          variant="ghost"
          leadingIcon={<ShieldCheck />}
          onClick={() => setAddingSuper(true)}
        >
          Add a KWHab superadmin
        </Button>
      </div>
      {loadError ? (
        <p role="alert" className="text-lg text-danger-fg">
          Couldn&apos;t load accounts. Please refresh and try again.
        </p>
      ) : (
        <TableCard
          caption="Organizations, their staff logins, their access level, and how many programs each owns."
          head={["Organization", "Login email", "Access", "Programs", ""]}
        >
          {loading ? (
            <EmptyRow colSpan={5} text="Loading…" />
          ) : admins.length === 0 ? (
            <EmptyRow colSpan={5} text="No organizations yet." />
          ) : (
            admins.map((a) => {
              // "You" is your organization — the login you hold may be
              // one of its staff logins, and removing the organization
              // removes those too.
              const isMe = a.id === ctx.org.id;
              const busy = busyId === a.id;
              return (
                <tr key={a.id} className="align-middle">
                  <th scope="row" className="px-3 py-3 font-normal">
                    {a.name}
                    {isMe && (
                      <span className="ml-3">
                        <Pill tone="good">You</Pill>
                      </span>
                    )}
                    {!!a.staff?.length && (
                      <ul className="mt-2 flex flex-col gap-1 text-base text-fg-muted">
                        {a.staff.map((s) => (
                          <li key={s.id} className="flex flex-wrap gap-x-3">
                            <span>{s.name}</span>
                            <span className="break-all">{s.email}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </th>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-3">
                      {a.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.logo_url}
                          alt=""
                          className="size-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <Avatar name={a.name} />
                      )}
                      {/* The table scrolls sideways; a wrapped address is
                          unreadable. */}
                      <span className="whitespace-nowrap">{a.email}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {/* Shown, not changed here: a superadmin is added on
                        purpose, with "Add a KWHab superadmin". */}
                    <Pill tone={a.is_admin ? "warn" : "neutral"}>
                      {a.is_admin ? "Superadmin" : "Admin"}
                    </Pill>
                  </td>
                  <td className="px-3 py-3">{a.event_count}</td>
                  <td className="px-3 py-3">
                    <span className="flex justify-end gap-2">
                      {!isMe && (
                        <Button
                          variant="ghost"
                          aria-label={`Remove ${a.name}`}
                          title="Remove"
                          disabled={busy}
                          onClick={() => setRemoving(a)}
                          className="text-danger-fg"
                          leadingIcon={<Trash2 />}
                        />
                      )}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </TableCard>
      )}

      {addingSuper && (
        <SuperadminModal
          onClose={() => setAddingSuper(false)}
          onSent={() => void load()}
        />
      )}
      {removing && (
        <RemoveAdminModal
          admin={removing}
          onClose={() => setRemoving(null)}
          onRemoved={(name, retired) => {
            setRemoving(null);
            show({
              title: `Removed ${name}.`,
              description:
                retired > 0
                  ? `${retired} ${retired === 1 ? "program" : "programs"} retired with the account.`
                  : undefined,
              tone: "alert",
            });
            void load();
          }}
        />
      )}
    </div>
  );
}

/**
 * Invite an organization by email. The API mails the accept link and hands
 * the token back once, so the link can also be copied and passed on by hand
 * if the mail doesn't arrive.
 */
function InviteForm({
  onSent,
}: {
  onSent: () => void;
}) {
  const { show } = useToast();
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{
    org: string;
    email: string;
    url: string;
    emailed: boolean;
  } | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const inv = await createInvite({
        organization: organization.trim(),
        email: email.trim(),
        // An agency, always: superadmins have their own button and form.
        is_admin: false,
      });
      setSent({
        org: inv.organization,
        email: inv.email,
        url: `${window.location.origin}/host/invite/${inv.token}`,
        emailed: inv.emailed,
      });
      setOrganization("");
      setEmail("");
      onSent();
    } catch (e) {
      setError(apiMessage(e, "Couldn't send that invitation."));
    } finally {
      setBusy(false);
    }
  }

  return (
    // Boxed: adding an organization is its own task on this page.
    <section className="flex max-w-[1026px] flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6">
      <div>
        <h2 className="text-xl font-medium text-fg">
          Invite Organization to the Belonging Collective
        </h2>
        <p className="text-xl text-fg">
          For a new agency joining the platform. We email them a link to set
          up their organization&apos;s login and choose a password.
        </p>
      </div>

      {sent && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-control border-[3px] border-toast-success bg-tag-free-bg px-5 py-3 text-lg text-fg"
        >
          <span className="flex-1">
            {sent.emailed ? (
              <>
                Invitation sent to <strong>{sent.email}</strong> for {sent.org}.
              </>
            ) : (
              // The invitation exists; only the email didn't go out (mail
              // not set up, or the mail server refused it).
              <>
                Invitation created for {sent.org}, but the email to{" "}
                <strong>{sent.email}</strong> couldn&apos;t be sent. Copy the
                link and send it to them yourself.
              </>
            )}{" "}
            It works once and expires in 14 days.
          </span>
          <Button
            leadingIcon={<Copy />}
            onClick={() => {
              void copyText(sent.url, show).then(
                (ok) => ok && show({ title: "Invite link copied." }),
              );
            }}
          >
            Copy link
          </Button>
          <Button variant="ghost" onClick={() => setSent(null)}>
            Send another
          </Button>
        </div>
      )}

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && organization.trim() && email.trim()) void send();
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <TextField
            label="Organization"
            className="flex-1 [&>label]:sr-only"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="Organization name"
            autoComplete="organization"
          />
          <TextField
            label="Email"
            className="flex-1 [&>label]:sr-only"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Organization's email"
            autoComplete="off"
          />
          <Button
            type="submit"
            variant="secondary"
            className="min-h-12"
            disabled={busy || !organization.trim() || !email.trim()}
            trailingIcon={<SendHorizontal />}
          >
            {busy ? "Sending…" : "Send invitation"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-base text-danger-fg">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

function RemoveAdminModal({
  admin,
  onClose,
  onRemoved,
}: {
  admin: AdminAccount;
  onClose: () => void;
  onRemoved: (name: string, retired: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await deleteAdmin(admin.id);
      onRemoved(admin.name, admin.event_count);
    } catch (e) {
      setError(apiMessage(e, "Couldn't remove that organization. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal
      tone="danger"
      onClose={onClose}
      title={
        <>
          <p className="text-2xl text-fg">
            Are you sure you want to remove this organization?
          </p>
          <p className="mt-1 text-2xl font-medium italic text-fg">{admin.name}</p>
        </>
      }
    >
      <p className="mt-3 text-lg text-fg-muted">
        They won&apos;t be able to sign in
        {admin.staff?.length ? ", and neither will their staff logins" : ""}.{" "}
        {admin.event_count > 0 ? (
          <>
            Their{" "}
            <strong className="text-fg">
              {admin.event_count} {admin.event_count === 1 ? "program" : "programs"}
            </strong>{" "}
            will leave the member feed. Nothing is deleted, and past attendance
            still counts.
          </>
        ) : (
          "They don't own any programs."
        )}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-base text-danger-fg">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => void submit()}>
          {busy ? "Removing…" : "Yes, remove"}
        </Button>
      </div>
    </Modal>
  );
}


/**
 * Inviting a superadmin — someone who runs the whole platform, which is
 * KW Habilitation. Its own form, so it can never be ticked by accident on an
 * ordinary agency's invitation, and it says plainly what it grants. Most
 * KWHab staff belong on KWHab's own Team instead, where they get the same
 * access without a separate organization.
 */
function SuperadminModal({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => void;
}) {
  const { show } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; url: string; emailed: boolean } | null>(
    null,
  );

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const inv = await createInvite({
        organization: name.trim(),
        email: email.trim(),
        is_admin: true,
      });
      setSent({
        email: inv.email,
        url: `${window.location.origin}/host/invite/${inv.token}`,
        emailed: inv.emailed,
      });
      onSent();
    } catch (e) {
      setError(apiMessage(e, "Couldn't send that invitation."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add a KWHab superadmin" onClose={onClose}>
      {sent ? (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-lg text-fg">
            {sent.emailed
              ? `Invitation sent to ${sent.email}.`
              : `Invitation created, but the email to ${sent.email} couldn't be sent. Copy the link and send it to them yourself.`}{" "}
            It works once and expires in 14 days.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              leadingIcon={<Copy />}
              onClick={() => {
                void copyText(sent.url, show).then(
                  (ok) => ok && show({ title: "Invite link copied." }),
                );
              }}
            >
              Copy link
            </Button>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && name.trim() && email.trim()) void submit();
          }}
        >
          <div className="rounded-control border border-danger-border bg-danger/40 p-4">
            <p className="text-base font-medium text-fg">A superadmin can:</p>
            <ul className="mt-1 list-disc pl-5 text-base text-fg">
              <li>add, remove and promote any organization</li>
              <li>edit and un-publish any organization&apos;s programs</li>
              <li>manage community member accounts and topics</li>
              <li>see every organization&apos;s analytics and special access</li>
            </ul>
            <p className="mt-2 text-base text-fg">
              Only for KW Habilitation, which runs the platform.
            </p>
          </div>
          <p className="text-base text-fg-muted">
            Adding someone who works at KW Habilitation? Add them on KW
            Habilitation&apos;s <a href="/host/team" className="underline underline-offset-2">Team page</a>{" "}
            instead. They become a superadmin automatically, without a
            separate organization.
          </p>
          <TextField
            label="Name"
            placeholder="e.g. KW Habilitation – Programs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <TextField
            label="Email"
            placeholder="Their email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-base text-danger-fg">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              variant="primary"
              leadingIcon={<SendHorizontal />}
              disabled={busy || !name.trim() || !email.trim()}
            >
              {busy ? "Sending…" : "Send superadmin invitation"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
