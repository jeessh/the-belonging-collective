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
  resetMemberKey,
  updateMember,
  type MemberAccount,
} from "@/lib/api";
import { emojiFor } from "@/lib/icons";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { EmptyRow, Pill, TableCard } from "@/components/AdminTable";
import { Modal } from "@/components/Modal";
import { AccountsNav } from "@/components/host/AccountsNav";

/**
 * Community member accounts. This page is the whole of member account
 * recovery: there is no "forgot password" for members, so the only way back
 * in is a superadmin re-issuing the key here and reading it out.
 */
export default function UsersPage() {
  return <AdminShell requireSuperadmin>{() => <Members />}</AdminShell>;
}

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
  const [newKey, setNewKey] = useState<{ name: string; icons: string[] } | null>(
    null,
  );

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

  async function resetKey() {
    const m = resetting;
    if (!m) return;
    setResetting(null);
    try {
      const updated = await resetMemberKey(m.id);
      // Straight into the same "write this down" modal the add flow ends on —
      // a new key is a new key, however it came about.
      setNewKey({
        name: `${updated.first_name} ${updated.last_name}`,
        icons: updated.icons,
      });
      await load();
    } catch (e) {
      show({ title: apiMessage(e, "Couldn't reset that key."), tone: "alert" });
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
          Everyone with a member account and how they sign in. Reset key issues
          a new icon key when someone can&apos;t remember theirs.
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
          caption="Community member accounts and how they sign in."
          head={["Name", "Sign-in", "Joined", ""]}
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
                  {m.auth_type === "password" ? (
                    <span className="inline-flex flex-wrap items-center gap-3">
                      <Pill>Password</Pill>
                      <span className="break-all">{m.email}</span>
                    </span>
                  ) : (
                    <>
                      <span aria-hidden="true" className="text-3xl">
                        {m.icons.map((i) => emojiFor(i)).join(" ")}
                      </span>
                      <span className="sr-only">
                        Icons: {m.icons.join(", ")}
                      </span>
                    </>
                  )}
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
                      Reset key
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
        <NameModal
          title="Add a member"
          lead="For setting someone up in person. Their icon key is generated and shown once."
          submitLabel="Create"
          onClose={() => setAdding(false)}
          onSubmit={async (first, last) => {
            const created = await createMember({ first_name: first, last_name: last });
            setAdding(false);
            setNewKey({
              name: `${created.first_name} ${created.last_name}`,
              icons: created.icons,
            });
            void load();
          }}
        />
      )}

      {editing && (
        <NameModal
          title="Edit member"
          lead="To change the sign-in icons, use Reset key instead — a set typed in here could collide with another account under the same name."
          submitLabel="Save"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (first, last) => {
            await updateMember(editing.id, { first_name: first, last_name: last });
            setEditing(null);
            show({ title: `Updated ${first} ${last}.` });
            void load();
          }}
        />
      )}

      {newKey && (
        <Modal title="Write this down" onClose={() => setNewKey(null)}>
          <p className="mt-2 text-lg text-fg">
            {newKey.name} signs in with their name and{" "}
            {newKey.icons.length === 1 ? "this icon" : "these icons"}
            {newKey.icons.length > 1 ? ", in this order" : ""}.
          </p>
          <p className="mt-4 text-center text-5xl" aria-hidden="true">
            {newKey.icons.map((i) => emojiFor(i)).join(" ")}
          </p>
          <p className="sr-only">{newKey.icons.join(", ")}</p>
          <p className="mt-4 text-base text-fg-muted">
            Written down is best, but nothing is lost if it isn&apos;t — the key
            is listed in the table, and Reset key issues a new one.
          </p>
          <div className="mt-6 flex justify-end">
            <Button variant="primary" onClick={() => setNewKey(null)}>
              Done
            </Button>
          </div>
        </Modal>
      )}

      {resetting && (
        <Modal
          title={`Reset ${resetting.first_name}'s key?`}
          onClose={() => setResetting(null)}
        >
          <p className="mt-2 text-lg text-fg">
            They get new icons to sign in with. What they have now stops
            working
            {resetting.auth_type === "password"
              ? ", including their password — the account becomes an icon account"
              : ""}
            , so only do this if they can be told.
          </p>
          <p className="mt-3 text-base text-fg-muted">
            Nothing else changes — their saved programs and topics stay.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button onClick={() => setResetting(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => void resetKey()}>
              Reset key
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

/** First + last name, for adding a member and for renaming one. */
function NameModal({
  title,
  lead,
  submitLabel,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  lead: string;
  submitLabel: string;
  initial?: { first_name: string; last_name: string };
  onClose: () => void;
  onSubmit: (first: string, last: string) => Promise<void>;
}) {
  const [first, setFirst] = useState(initial?.first_name ?? "");
  const [last, setLast] = useState(initial?.last_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(first.trim(), last.trim());
    } catch (e) {
      setError(apiMessage(e, "Couldn't save that. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="mt-2 text-lg text-fg-muted">{lead}</p>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && first.trim() && last.trim()) void submit();
        }}
      >
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
            disabled={busy || !first.trim() || !last.trim()}
          >
            {busy ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
