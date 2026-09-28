"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Pencil, Plus } from "lucide-react";
import {
  ApiError,
  apiMessage,
  archiveAccessGroup,
  createAccessGroup,
  decideAccess,
  fetchAccessGroups,
  fetchAccessMembers,
  listAdmins,
  renameAccessGroup,
  type AccessGroup,
  type AccessMember,
  type AdminAccount,
} from "@/lib/api";
import { TIME_ZONE } from "@/lib/time";
import { AdminShell, type ConsoleContext } from "@/components/AdminShell";
import { Button } from "@/components/ui/Button";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { EmptyRow, Pill, TableCard } from "@/components/AdminTable";
import { Modal } from "@/components/Modal";

/**
 * Special access: the organization's groups, and who is in, waiting, or out.
 *
 * A group is the unit — one approval covers every program filed under it —
 * so the page is a list of groups beside the chosen group's members. Rows are
 * never deleted; a declined member is still here, on the Declined tab, in
 * case the decision was a mistake.
 */
export default function AccessPage() {
  return <AdminShell>{(ctx) => <SpecialAccess ctx={ctx} />}</AdminShell>;
}

const memberName = (m: AccessMember) => `${m.first_name} ${m.last_name}`.trim();

/** "Sep 27, 2026" — the table has four columns to fit. */
function shortDate(iso?: string | null): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleDateString("en-CA", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SpecialAccess({ ctx }: { ctx: ConsoleContext }) {
  const router = useRouter();
  const { show } = useToast();
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<AccessGroup | null>(null);
  const [archiving, setArchiving] = useState<AccessGroup | null>(null);

  async function load() {
    try {
      const rows = await fetchAccessGroups();
      setGroups(rows);
      setLoadError(false);
      // Keep the chosen group if it is still there; otherwise the first.
      setSelectedId((cur) =>
        cur && rows.some((g) => g.id === cur) ? cur : (rows[0]?.id ?? null),
      );
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

  function refresh() {
    void load();
    ctx.refreshPendingAccess();
  }

  const selected = groups.find((g) => g.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-[840px] flex-col gap-3">
          <h1 className="text-4xl font-medium text-fg sm:text-5xl">
            Special Access
          </h1>
          <p className="text-xl text-fg">
            Some programs are only for people your organization has approved. A
            group is who&apos;s approved, and one approval covers every program
            filed under it. Members ask from a program&apos;s page; you answer
            here.
          </p>
        </div>
        <Button
          variant="primary"
          trailingIcon={<Plus />}
          onClick={() => setCreating(true)}
        >
          New group
        </Button>
      </div>

      {loadError ? (
        <p role="alert" className="text-lg text-danger-fg">
          Couldn&apos;t load your groups. Please refresh and try again.
        </p>
      ) : loading ? (
        <p className="text-lg text-fg-muted">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-control border border-line bg-surface p-8 text-center">
          <p className="text-3xl font-medium text-fg">No groups yet</p>
          <p className="max-w-[560px] text-xl text-fg-muted">
            Create one, then choose it under &ldquo;Who can see this&rdquo; on
            a program. Only people you approve will find that program.
          </p>
          <Button
            variant="primary"
            size="lg"
            className="mt-4"
            trailingIcon={<Plus />}
            onClick={() => setCreating(true)}
          >
            Create a group
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-8 lg:flex-row">
          <nav
            aria-label="Groups"
            className="w-full rounded-control border border-line bg-surface p-2.5 lg:w-[320px] lg:shrink-0"
          >
            <ul className="flex flex-col gap-1">
              {groups.map((g) => {
                const on = g.id === selectedId;
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      aria-current={on ? "true" : undefined}
                      onClick={() => setSelectedId(g.id)}
                      className={`flex w-full flex-col gap-2 rounded-control border px-4 py-3 text-left transition-colors ${
                        on
                          ? "border-primary-border bg-primary-soft"
                          : "border-transparent hover:bg-surface-subtle"
                      }`}
                    >
                      <span className="text-xl font-medium text-fg">{g.name}</span>
                      {ctx.isSuper && (
                        <span className="text-base text-fg-muted">{g.host_name}</span>
                      )}
                      <span className="flex flex-wrap gap-2">
                        <Pill tone={g.pending_count > 0 ? "warn" : "neutral"}>
                          {g.pending_count} waiting
                        </Pill>
                        <Pill tone="good">{g.approved_count} approved</Pill>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {selected && (
            <GroupPanel
              key={selected.id}
              group={selected}
              isSuper={ctx.isSuper}
              onRename={() => setRenaming(selected)}
              onArchive={() => setArchiving(selected)}
              onChanged={refresh}
            />
          )}
        </div>
      )}

      {creating && (
        <GroupModal
          isSuper={ctx.isSuper}
          ownOrgId={ctx.session.id ?? ""}
          onClose={() => setCreating(false)}
          onSaved={(g) => {
            setCreating(false);
            show({ title: `Created '${g.name}'.` });
            setSelectedId(g.id);
            refresh();
          }}
        />
      )}
      {renaming && (
        <GroupModal
          isSuper={ctx.isSuper}
          ownOrgId={ctx.session.id ?? ""}
          group={renaming}
          onClose={() => setRenaming(null)}
          onSaved={(g) => {
            setRenaming(null);
            show({ title: `Renamed to '${g.name}'.` });
            refresh();
          }}
        />
      )}
      {archiving && (
        <ArchiveModal
          group={archiving}
          onClose={() => setArchiving(null)}
          onDone={() => {
            setArchiving(null);
            show({ title: `Archived '${archiving.name}'.`, tone: "alert" });
            refresh();
          }}
        />
      )}
    </div>
  );
}

/* ---------------- one group's members ---------------- */

type Tab = "requested" | "approved" | "declined";

function GroupPanel({
  group,
  isSuper,
  onRename,
  onArchive,
  onChanged,
}: {
  group: AccessGroup;
  isSuper: boolean;
  onRename: () => void;
  onArchive: () => void;
  /** After a decision: the counts on the list and the header badge move. */
  onChanged: () => void;
}) {
  const { show } = useToast();
  const [tab, setTab] = useState<Tab>("requested");
  const [members, setMembers] = useState<AccessMember[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<AccessMember | null>(null);

  async function load() {
    try {
      setMembers(await fetchAccessMembers(group.id));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  async function decide(
    m: AccessMember,
    decision: "approve" | "decline" | "revoke",
  ) {
    setBusyId(m.user_id);
    try {
      await decideAccess(group.id, m.user_id, decision);
      const name = memberName(m);
      show(
        decision === "approve"
          ? { title: `Approved ${name}.` }
          : decision === "decline"
            ? { title: `Declined ${name}.`, tone: "alert" }
            : { title: `Revoked access for ${name}.`, tone: "alert" },
      );
      await load();
      onChanged();
    } catch (e) {
      show({
        title: apiMessage(e, "Couldn't save that decision. Please try again."),
        tone: "alert",
      });
    } finally {
      setBusyId(null);
    }
  }

  const rows = (members ?? []).filter((m) =>
    tab === "declined"
      ? m.status === "declined" || m.status === "revoked"
      : m.status === tab,
  );
  const count = (t: Tab) =>
    (members ?? []).filter((m) =>
      t === "declined"
        ? m.status === "declined" || m.status === "revoked"
        : m.status === t,
    ).length;

  const EMPTY: Record<Tab, string> = {
    requested: "No requests waiting.",
    approved: "Nobody has been approved yet.",
    declined: "Nobody has been declined.",
  };

  return (
    <section
      aria-labelledby="group-heading"
      className="flex w-full min-w-0 flex-1 flex-col gap-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="group-heading" className="text-3xl font-medium text-fg">
            {group.name}
          </h2>
          {isSuper && <p className="text-lg text-fg-muted">{group.host_name}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button leadingIcon={<Pencil />} onClick={onRename}>
            Rename
          </Button>
          <Button variant="ghost" leadingIcon={<Archive />} onClick={onArchive}>
            Archive
          </Button>
        </div>
      </div>

      <SegmentedToggle<Tab>
        label="Members by status"
        className="self-start max-sm:w-full [&>button]:flex-1"
        value={tab}
        onChange={setTab}
        segments={[
          { value: "requested", label: `Requests (${count("requested")})` },
          { value: "approved", label: `Approved (${count("approved")})` },
          { value: "declined", label: `Declined (${count("declined")})` },
        ]}
      />

      {loadError ? (
        <p role="alert" className="text-lg text-danger-fg">
          Couldn&apos;t load this group&apos;s members. Please refresh and try
          again.
        </p>
      ) : (
        <TableCard
          caption={`Members of ${group.name} — ${tab}`}
          head={["Member", "Email", tab === "requested" ? "Requested" : "Decided", ""]}
        >
          {members === null ? (
            <EmptyRow colSpan={4} text="Loading…" />
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={4} text={EMPTY[tab]} />
          ) : (
            rows.map((m) => {
              const busy = busyId === m.user_id;
              const name = memberName(m);
              return (
                <tr key={m.user_id} className="align-middle">
                  <th scope="row" className="min-w-[180px] px-3 py-3 font-normal">
                    {name}
                    {/* Which program they asked from — the context an admin
                        decides on. */}
                    {m.requested_via && (
                      <span className="block text-base text-fg-muted">
                        via{" "}
                        <Link
                          href={`/host/events/${m.requested_via.id}`}
                          className="text-[#307CFF] underline underline-offset-4"
                        >
                          {m.requested_via.title}
                        </Link>
                      </span>
                    )}
                  </th>
                  <td className="min-w-[220px] px-3 py-3 text-fg-muted">
                    <span className="break-all">{m.email || "—"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {tab === "declined" && (
                      <span className="mr-3">
                        <Pill tone="warn">
                          {m.status === "revoked" ? "Revoked" : "Declined"}
                        </Pill>
                      </span>
                    )}
                    {shortDate(
                      tab === "requested" ? m.requested_at : m.decided_at,
                    ) || "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex justify-end gap-2 whitespace-nowrap">
                      {tab === "approved" ? (
                        <Button
                          variant="ghost"
                          disabled={busy}
                          style={{ color: "#CC0000" }}
                          onClick={() => setRevoking(m)}
                        >
                          Revoke
                          <span className="sr-only"> access for {name}</span>
                        </Button>
                      ) : (
                        <>
                          {tab === "requested" && (
                            <Button
                              variant="ghost"
                              disabled={busy}
                              onClick={() => void decide(m, "decline")}
                            >
                              Decline
                              <span className="sr-only"> {name}</span>
                            </Button>
                          )}
                          <Button
                            variant="primary"
                            disabled={busy}
                            onClick={() => void decide(m, "approve")}
                          >
                            Approve
                            <span className="sr-only"> {name}</span>
                          </Button>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </TableCard>
      )}

      {revoking && (
        <Modal
          onClose={() => setRevoking(null)}
          title={
            <>
              <p className="text-2xl text-fg">Revoke access for this member?</p>
              <p className="mt-1 text-2xl font-medium italic text-fg">
                {memberName(revoking)}
              </p>
            </>
          }
        >
          <p className="mt-3 text-lg text-fg-muted">
            They stop seeing programs in {group.name} straight away. Programs
            they already saved stay on their list, and you can approve them
            again from the Declined tab.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => setRevoking(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                const m = revoking;
                setRevoking(null);
                void decide(m, "revoke");
              }}
            >
              Yes, revoke
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

/* ---------------- modals ---------------- */

/** Create (no `group`) or rename. A superadmin picks the owning organization. */
function GroupModal({
  isSuper,
  ownOrgId,
  group,
  onClose,
  onSaved,
}: {
  isSuper: boolean;
  ownOrgId: string;
  group?: AccessGroup;
  onClose: () => void;
  onSaved: (group: AccessGroup) => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [orgId, setOrgId] = useState(ownOrgId);
  const [orgs, setOrgs] = useState<AdminAccount[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The org list is superadmin-only, and only creating needs it.
  useEffect(() => {
    if (!isSuper || group) return;
    listAdmins()
      .then(setOrgs)
      .catch(() => setOrgs([]));
  }, [isSuper, group]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const saved = group
        ? await renameAccessGroup(group.id, name.trim())
        : await createAccessGroup(name.trim(), orgId || undefined);
      onSaved(saved);
    } catch (e) {
      setError(apiMessage(e, "Couldn't save that group. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal title={group ? "Rename group" : "New group"} onClose={onClose}>
      {!group && (
        <p className="mt-2 text-lg text-fg-muted">
          Name it the way your staff talk about it — the residence, the
          program, the cohort.
        </p>
      )}
      <form
        className="mt-5 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && !busy) void submit();
        }}
      >
        <TextField
          label="Group name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Residential program"
          autoComplete="off"
          autoFocus
        />
        {isSuper && !group && (
          <label className="flex flex-col gap-1">
            <span className="text-lg font-medium text-fg">Organization</span>
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="min-h-12 w-full rounded-field border border-line bg-surface px-4 py-3 text-lg text-fg"
            >
              {(orgs ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <p role="alert" className="text-base text-danger-fg">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || busy}>
            {busy ? "Saving…" : group ? "Save name" : "Create group"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ArchiveModal({
  group,
  onClose,
  onDone,
}: {
  group: AccessGroup;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await archiveAccessGroup(group.id);
      onDone();
    } catch (e) {
      // The 409 says how many live programs still use it — worth repeating.
      setError(apiMessage(e, "Couldn't archive that group. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      title={
        <>
          <p className="text-2xl text-fg">Archive this group?</p>
          <p className="mt-1 text-2xl font-medium italic text-fg">{group.name}</p>
        </>
      }
    >
      <p className="mt-3 text-lg text-fg-muted">
        It leaves this page and the program form. Nothing is deleted — who was
        approved is kept. A group still used by a live program can&apos;t be
        archived until that program is moved or un-published.
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
          {busy ? "Archiving…" : "Yes, archive"}
        </Button>
      </div>
    </Modal>
  );
}
