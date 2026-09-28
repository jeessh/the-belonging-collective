"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  ApiError,
  apiMessage,
  createMember,
  deleteMember,
  listMembers,
  setMemberPassword,
  updateMember,
  type MemberAccount,
} from "@/lib/api";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { EmptyRow, Pill, TableCard } from "@/components/AdminTable";
import { Modal } from "@/components/Modal";
import { AccountsNav } from "@/components/host/AccountsNav";

/**
 * Community member accounts. Members reset their own password by email;
 * this page is the other way back in — a superadmin sets a temporary
 * password and reads it out. That is also how accounts from before email
 * sign-in (no password yet) get in.
 */
export default function UsersPage() {
  return <AdminShell requireSuperadmin>{() => <Members />}</AdminShell>;
}

/** A temporary password, shown once. */
type Issued = { name: string; email: string; password: string };

function Members() {
  const router = useRouter();
  const { show } = useToast();
  const [members, setMembers] = useState<MemberAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MemberAccount | null>(null);
  const [removing, setRemoving] = useState<MemberAccount | null>(null);
  const [resetting, setResetting] = useState<MemberAccount | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);

  async function load() {
    try {
      setMembers(await listMembers());
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

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      `${m.first_name} ${m.last_name} ${m.email ?? ""}`.toLowerCase().includes(q),
    );
  }, [members, search]);

  async function remove() {
    const m = removing;
    if (!m) return;
    setRemoving(null);
    try {
      await deleteMember(m.id);
      show({ title: `Removed ${m.first_name} ${m.last_name}.`, tone: "alert" });
      await load();
    } catch (e) {
      show({ title: apiMessage(e, "Couldn't remove that account."), tone: "alert" });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <AccountsNav />

      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-medium text-fg sm:text-5xl">
          Community Members
        </h1>
        <p className="text-xl text-fg">
          Everyone with a member account. Set password gives someone a
          temporary password to read out when they can&apos;t get in.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="relative block w-full max-w-[428px]">
          <span className="sr-only">Search members</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-6 top-1/2 size-6 -translate-y-1/2 text-fg-icon"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="min-h-14 w-full rounded-control border border-line bg-surface-subtle py-3 pl-16 pr-6 text-xl text-fg placeholder:text-fg-muted"
          />
        </label>
        <Button
          variant="primary"
          trailingIcon={<Plus />}
          onClick={() => setAdding(true)}
        >
          Add member
        </Button>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {loading
          ? "Loading members"
          : `${shown.length} of ${members.length} members shown`}
      </p>

      {loadError ? (
        <p role="alert" className="text-lg text-danger-fg">
          Couldn&apos;t load members. Please refresh and try again.
        </p>
      ) : (
        <TableCard
          caption="Community member accounts and the email they sign in with."
          head={["Name", "Email", "Joined", ""]}
        >
          {loading ? (
            <EmptyRow colSpan={4} text="Loading…" />
          ) : shown.length === 0 ? (
            <EmptyRow
              colSpan={4}
              text={members.length === 0 ? "No members yet." : "No members match that."}
            />
          ) : (
            shown.map((m) => (
              <tr key={m.id} className="align-middle">
                <th scope="row" className="px-3 py-3 font-normal">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {m.first_name} {m.last_name}
                    {m.is_caregiver && (
                      <Pill tone="good">
                        Caregiver
                        {m.care.length > 0 ? ` · ${m.care.length} linked` : ""}
                      </Pill>
                    )}
                  </span>
                </th>
                <td className="px-3 py-3">
                  <span className="inline-flex flex-wrap items-center gap-3">
                    {m.email ? (
                      <span className="break-all">{m.email}</span>
                    ) : (
                      <span className="text-fg-muted">No email</span>
                    )}
                    {/* An account from before email sign-in: it can't get in
                        until Set password gives it one. */}
                    {m.auth_type !== "password" && <Pill>No password yet</Pill>}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-fg-muted">
                  {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-3">
                  <span className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      aria-label={`Edit ${m.first_name}`}
                      title="Edit name"
                      onClick={() => setEditing(m)}
                      leadingIcon={<Pencil />}
                    />
                    <Button
                      variant="ghost"
                      onClick={() => setResetting(m)}
                      leadingIcon={<KeyRound />}
                    >
                      Set password
                      <span className="sr-only"> for {m.first_name}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Remove ${m.first_name}`}
                      title="Remove"
                      style={{ color: "#CC0000" }}
                      onClick={() => setRemoving(m)}
                      leadingIcon={<Trash2 />}
                    />
                  </span>
                </td>
              </tr>
            ))
          )}
        </TableCard>
      )}

      {adding && (
        <MemberModal
          title="Add a member"
          lead="For setting someone up in person. A temporary password is generated and shown once."
          submitLabel="Create"
          withEmail
          onClose={() => setAdding(false)}
          onSubmit={async ({ first, last, email }) => {
            const created = await createMember({
              first_name: first,
              last_name: last,
              email,
            });
            setAdding(false);
            setIssued({
              name: `${created.first_name} ${created.last_name}`,
              email: created.email,
              password: created.password,
            });
            void load();
          }}
        />
      )}

      {editing && (
        <MemberModal
          title="Edit member"
          lead="Their name only. To change the email they sign in with, use Set password."
          submitLabel="Save"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async ({ first, last }) => {
            await updateMember(editing.id, { first_name: first, last_name: last });
            setEditing(null);
            show({ title: `Updated ${first} ${last}.` });
            void load();
          }}
        />
      )}

      {resetting && (
        <MemberModal
          title={`Set a password for ${resetting.first_name}?`}
          lead="Confirm the email they will sign in with. A temporary password is generated; what they have now stops working, so only do this if they can be told."
          submitLabel="Set password"
          emailOnly
          initial={resetting}
          onClose={() => setResetting(null)}
          onSubmit={async ({ email }) => {
            const out = await setMemberPassword(resetting.id, email);
            setResetting(null);
            setIssued({
              name: `${resetting.first_name} ${resetting.last_name}`,
              email: out.email,
              password: out.password,
            });
            void load();
          }}
        />
      )}

      {issued && (
        <Modal title="Read this out" onClose={() => setIssued(null)}>
          <p className="mt-2 text-lg text-fg">
            {issued.name} logs in with <strong>{issued.email}</strong> and this
            temporary password:
          </p>
          <p className="mt-4 text-center font-mono text-3xl tracking-wide text-fg sm:text-4xl">
            {issued.password}
          </p>
          <p className="mt-4 text-base text-fg-muted">
            It is shown once. They can change it from &quot;Forgot your
            password?&quot; at login, or you can set another one here.
          </p>
          <div className="mt-6 flex justify-end">
            <Button variant="primary" onClick={() => setIssued(null)}>
              Done
            </Button>
          </div>
        </Modal>
      )}

      {removing && (
        <Modal
          title={`Remove ${removing.first_name}?`}
          onClose={() => setRemoving(null)}
        >
          <p className="mt-2 text-lg text-fg">
            They won&apos;t be able to sign in. Their saved programs stay
            counted for the organizations that ran them.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => void remove()}>
              Yes, remove
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * Name and/or email: adding a member (both), renaming one (name only) and
 * setting a password (email only).
 */
function MemberModal({
  title,
  lead,
  submitLabel,
  initial,
  withEmail = false,
  emailOnly = false,
  onClose,
  onSubmit,
}: {
  title: string;
  lead: string;
  submitLabel: string;
  initial?: { first_name: string; last_name: string; email?: string | null };
  withEmail?: boolean;
  emailOnly?: boolean;
  onClose: () => void;
  onSubmit: (values: { first: string; last: string; email: string }) => Promise<void>;
}) {
  const [first, setFirst] = useState(initial?.first_name ?? "");
  const [last, setLast] = useState(initial?.last_name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askName = !emailOnly;
  const askEmail = withEmail || emailOnly;
  const ready =
    (!askName || (first.trim() !== "" && last.trim() !== "")) &&
    (!askEmail || email.trim() !== "");

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        first: first.trim(),
        last: last.trim(),
        email: email.trim().toLowerCase(),
      });
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 422
          ? "Enter a valid email address."
          : apiMessage(e, "Couldn't save that. Please try again."),
      );
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="mt-2 text-lg text-fg-muted">{lead}</p>
      <form
        className="mt-4 flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && ready) void submit();
        }}
      >
        {askName && (
          <>
            <TextField
              label="First name"
              autoFocus
              value={first}
              onChange={(e) => setFirst(e.target.value)}
            />
            <TextField
              label="Last name"
              value={last}
              onChange={(e) => setLast(e.target.value)}
            />
          </>
        )}
        {askEmail && (
          <TextField
            label="Email"
            type="email"
            autoFocus={emailOnly}
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        {error && (
          <p role="alert" className="text-base text-danger-fg">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || !ready}>
            {busy ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
