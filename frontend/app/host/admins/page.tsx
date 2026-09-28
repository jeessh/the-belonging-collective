"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, ImageIcon, SendHorizontal, Trash2 } from "lucide-react";
import {
  ApiError,
  apiMessage,
  createAdmin,
  createInvite,
  deleteAdmin,
  listAdmins,
  listInvites,
  revokeInvite,
  updateAdmin,
  type AdminAccount,
  type HostInvite,
} from "@/lib/api";
import { AdminShell, type ConsoleContext } from "@/components/AdminShell";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { EmptyRow, Pill, TableCard } from "@/components/AdminTable";
import { ImageDrop } from "@/components/ImageDrop";
import { Modal } from "@/components/Modal";
import { AccountsNav } from "@/components/host/AccountsNav";

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
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<AdminAccount | null>(null);
  const [logoFor, setLogoFor] = useState<AdminAccount | null>(null);

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
        router.replace("/host");
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

  async function setAccess(admin: AdminAccount, makeSuper: boolean) {
    setBusyId(admin.id);
    try {
      await updateAdmin(admin.id, { is_admin: makeSuper });
      show({
        title: `${admin.name} is now ${makeSuper ? "a superadmin" : "an admin"}.`,
      });
      await load();
    } catch (e) {
      show({
        title: apiMessage(e, "Couldn't change that account. Please try again."),
        tone: "alert",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <AccountsNav />

      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-medium text-fg sm:text-5xl">
          All Administrative Members
        </h1>
        <p className="text-xl text-fg">
          Organizations with administrative access to the events on The
          Belonging Collective, and the staff logins under each.
        </p>
      </div>

      <InviteForm onSent={() => void load()} onAddDirectly={() => setAdding(true)} />

      {invites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-medium text-fg">Invitations waiting</h2>
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

      {loadError ? (
        <p role="alert" className="text-lg text-danger-fg">
          Couldn&apos;t load accounts. Please refresh and try again.
        </p>
      ) : (
        <TableCard
          caption="Non-profits, their staff logins, their access level, and how many programs each owns."
          head={["Non-Profit", "Email", "Access", "Programs", ""]}
        >
          {loading ? (
            <EmptyRow colSpan={5} text="Loading…" />
          ) : admins.length === 0 ? (
            <EmptyRow colSpan={5} text="No accounts yet." />
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
                      <span className="break-all">{a.email}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex flex-wrap items-center gap-3">
                      <Pill tone={a.is_admin ? "warn" : "neutral"}>
                        {a.is_admin ? "Superadmin" : "Admin"}
                      </Pill>
                      {/* The API refuses self-demotion — that refusal is what
                          keeps at least one superadmin in the system. */}
                      {!isMe && (
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void setAccess(a, !a.is_admin)}
                        >
                          {a.is_admin ? "Make admin" : "Make superadmin"}
                          <span className="sr-only"> — {a.name}</span>
                        </Button>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-3">{a.event_count}</td>
                  <td className="px-3 py-3">
                    <span className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        aria-label={`Logo for ${a.name}`}
                        title="Logo"
                        disabled={busy}
                        onClick={() => setLogoFor(a)}
                        leadingIcon={<ImageIcon />}
                      />
                      {!isMe && (
                        <Button
                          variant="ghost"
                          aria-label={`Remove ${a.name}`}
                          title="Remove"
                          disabled={busy}
                          onClick={() => setRemoving(a)}
                          style={{ color: "#CC0000" }}
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

      {adding && (
        <AddAdminModal
          onClose={() => setAdding(false)}
          onCreated={(name) => {
            setAdding(false);
            show({ title: `Added ${name}.` });
            void load();
          }}
        />
      )}
      {logoFor && (
        <LogoModal
          admin={logoFor}
          onClose={() => setLogoFor(null)}
          onSaved={(name) => {
            setLogoFor(null);
            show({ title: `Updated the logo for ${name}.` });
            void load();
          }}
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
  onAddDirectly,
}: {
  onSent: () => void;
  onAddDirectly: () => void;
}) {
  const { show } = useToast();
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [isSuper, setIsSuper] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ org: string; email: string; url: string } | null>(
    null,
  );

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const inv = await createInvite({
        organization: organization.trim(),
        email: email.trim(),
        is_admin: isSuper,
      });
      setSent({
        org: inv.organization,
        email: inv.email,
        url: `${window.location.origin}/host/invite/${inv.token}`,
      });
      setOrganization("");
      setEmail("");
      setIsSuper(false);
      onSent();
    } catch (e) {
      setError(apiMessage(e, "Couldn't send that invitation."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex max-w-[1026px] flex-col gap-3">
      <div>
        <h2 className="text-xl font-medium text-fg">Invite New Members</h2>
        <p className="text-xl text-fg">
          Send a unique invite link to a new organization by email. They
          choose their own password when they open it.
        </p>
      </div>

      {sent && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-control border-[3px] border-toast-success bg-tag-free-bg px-5 py-3 text-lg text-fg"
        >
          <span className="flex-1">
            Invitation sent to <strong>{sent.email}</strong> for {sent.org}. It
            works once and expires in 14 days.
          </span>
          <Button
            leadingIcon={<Copy />}
            onClick={() => {
              void navigator.clipboard
                ?.writeText(sent.url)
                .then(() => show({ title: "Invite link copied." }))
                .catch(() => window.prompt("Copy this link:", sent.url));
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
            placeholder="Enter email"
            autoComplete="off"
          />
          <Button
            type="submit"
            variant="secondary"
            className="min-h-12"
            disabled={busy || !organization.trim() || !email.trim()}
            trailingIcon={<SendHorizontal />}
          >
            {busy ? "Sending…" : "Send Email"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-11 items-center gap-3 text-lg text-fg">
            <input
              type="checkbox"
              checked={isSuper}
              onChange={(e) => setIsSuper(e.target.checked)}
              className="size-5 shrink-0 accent-primary-border"
            />
            Can manage other organizations (KW Habilitation staff only)
          </label>
          <Button variant="ghost" onClick={onAddDirectly}>
            Create an account directly instead
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

function LogoModal({
  admin,
  onClose,
  onSaved,
}: {
  admin: AdminAccount;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [logoUrl, setLogoUrl] = useState(admin.logo_url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      // "" clears it — the API reads null as "leave alone".
      await updateAdmin(admin.id, { logo_url: logoUrl });
      onSaved(admin.name);
    } catch (e) {
      setError(apiMessage(e, "Couldn't save that logo. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Logo for ${admin.name}`} onClose={onClose}>
      <p className="mt-2 text-lg text-fg-muted">
        Members recognise organizations by their logo in the feed.
      </p>
      <div className="mt-4">
        <ImageDrop
          label="Organization logo"
          sizing="logo"
          value={logoUrl}
          onChange={setLogoUrl}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-base text-danger-fg">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={busy} onClick={() => void submit()}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function AddAdminModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSuper, setIsSuper] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim() && email.trim() && password.length >= 8;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await createAdmin({
        name: name.trim(),
        email: email.trim(),
        password,
        is_admin: isSuper,
      });
      onCreated(name.trim());
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError("That email already has an account.");
      } else if (e instanceof ApiError && e.status === 422) {
        setError("Check the email address and use at least 8 characters.");
      } else {
        setError("Couldn't create that account. Please try again.");
      }
      setBusy(false);
    }
  }

  return (
    <Modal title="Create an account" onClose={onClose}>
      <p className="mt-2 text-lg text-fg-muted">
        For setting an organization up in person. Share the temporary password
        with them directly and ask them to change it.
      </p>
      <form
        className="mt-5 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy) void submit();
        }}
      >
        <TextField
          label="Organization"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Temporary password (at least 8 characters)"
          type="text"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="flex min-h-11 items-center gap-3 text-lg text-fg">
          <input
            type="checkbox"
            checked={isSuper}
            onChange={(e) => setIsSuper(e.target.checked)}
            className="size-5 shrink-0 accent-primary-border"
          />
          Can manage other organizations
        </label>
        {error && (
          <p role="alert" className="text-base text-danger-fg">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!valid || busy}>
            {busy ? "Creating…" : "Create account"}
          </Button>
        </div>
      </form>
    </Modal>
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
      setError(apiMessage(e, "Couldn't remove that account. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      title={
        <>
          <p className="text-2xl text-fg">
            Are you sure you want to remove this account?
          </p>
          <p className="mt-1 text-2xl font-medium italic text-fg">{admin.name}</p>
        </>
      }
    >
      <p className="mt-3 text-lg text-fg-muted">
        They won&apos;t be able to sign in.{" "}
        {admin.event_count > 0 ? (
          <>
            Their{" "}
            <strong className="text-fg">
              {admin.event_count} {admin.event_count === 1 ? "program" : "programs"}
            </strong>{" "}
            will leave the member feed. Nothing is deleted — the programs stay
            filed under {admin.name}, and attendance already recorded still
            counts.
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
