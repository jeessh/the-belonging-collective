"use client";

import { useEffect, useState } from "react";
import { Lock, Plus, UserPlus } from "lucide-react";
import {
  addPeopleToGroup,
  apiMessage,
  createAccessGroup,
  fetchAccessGroups,
  listMembers,
  type AccessGroup,
  type AddPeopleResult,
  type MemberAccount,
} from "@/lib/api";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Field, SearchField, Select, TextArea } from "@/components/AdminTable";

export type AccessMode = "everyone" | "group";

/**
 * Special access: a group picker — None, everyone; a group, only its
 * approved members. Only members approved into one of the
 * organization's special-access groups. Groups are the program's own
 * organization's — a superadmin editing another agency's program sees that
 * agency's list, which is what the API accepts.
 */
export function AccessPicker({
  hostId,
  mode,
  groupId,
  onChange,
}: {
  /** The organization the program belongs to. */
  hostId: string;
  mode: AccessMode;
  groupId: string | null;
  onChange: (mode: AccessMode, groupId: string | null) => void;
}) {
  const [groups, setGroups] = useState<AccessGroup[] | null>(null);
  const [adding, setAdding] = useState(false);
  // The chosen group "Add members" was pressed for.
  const [addingTo, setAddingTo] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAccessGroups()
      .then((all) => {
        if (alive) setGroups(all.filter((g) => g.host_id === hostId));
      })
      .catch(() => {
        if (alive) setGroups([]);
      });
    return () => {
      alive = false;
    };
  }, [hostId]);


  return (
    // In a light grey box with a lock, so it reads as its own setting.
    <div className="flex w-full flex-col items-start gap-4 rounded-card border border-line/60 bg-surface-subtle/70 p-4">
      {/* No switch: the group picker is the choice — "None" means everyone
          can see it, a group restricts it to that group's members. */}
      <div className="flex flex-col gap-1">
        <p className="inline-flex items-center gap-2 text-lg font-medium text-fg">
          <Lock aria-hidden="true" className="text-fg-icon" />
          Special access
        </p>
        <p className="text-base text-fg-muted">
          Choose a group to show it only to that group&rsquo;s approved members.
          Leave it on None and everyone can see it.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Group" className="min-w-[240px] flex-1 sm:max-w-[420px]">
              <Select
                value={mode === "group" ? (groupId ?? "") : ""}
                onChange={(e) =>
                  e.target.value
                    ? onChange("group", e.target.value)
                    : onChange("everyone", null)
                }
                disabled={groups === null}
              >
                <option value="">
                  {groups === null ? "Loading…" : "None — everyone can see it"}
                </option>
                {(groups ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
            {mode === "group" && groupId && (
              <Button
                className="min-h-12"
                leadingIcon={<UserPlus />}
                onClick={() => setAddingTo(groupId)}
              >
                Add members
              </Button>
            )}
            {!adding && (
              <Button
                className="min-h-12"
                leadingIcon={<Plus />}
                onClick={() => setAdding(true)}
              >
                New group
              </Button>
            )}
          </div>

          {addingTo && (
            <AddMembersModal
              group={(groups ?? []).find((g) => g.id === addingTo) ?? null}
              groupId={addingTo}
              onClose={() => setAddingTo(null)}
            />
          )}

          {adding && (
            <NewGroupModal
              hostId={hostId}
              onClose={() => setAdding(false)}
              onCreated={(g) => {
                setGroups((cur) =>
                  [...(cur ?? []), g].sort((x, y) => x.name.localeCompare(y.name)),
                );
                onChange("group", g.id);
              }}
            />
          )}
        </div>
    </div>
  );
}

/**
 * The platform's community members, for checking off — superadmins only
 * (`GET /users` refuses anyone else), so for an ordinary organization this
 * is "unavailable" and the dialogs fall back to typing email addresses.
 */
function useMembers(): MemberAccount[] | null | "unavailable" {
  const [members, setMembers] = useState<MemberAccount[] | null | "unavailable">(null);
  useEffect(() => {
    let alive = true;
    listMembers()
      .then((all) => {
        if (!alive) return;
        setMembers(
          all
            .filter((m) => !!m.email)
            .sort((a, b) =>
              `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
            ),
        );
      })
      .catch(() => {
        if (alive) setMembers("unavailable");
      });
    return () => {
      alive = false;
    };
  }, []);
  return members;
}

/** Split typed addresses: one per line, or separated by commas / spaces. */
const typedEmails = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);

/**
 * Who goes in the group: a searchable checklist of existing members (for a
 * superadmin) and, for anyone else — or people not on the platform yet —
 * email addresses typed in. Hands back the combined list of addresses.
 */
function PeopleFields({
  picked,
  onPick,
  text,
  onText,
}: {
  picked: Set<string>;
  onPick: (next: Set<string>) => void;
  text: string;
  onText: (text: string) => void;
}) {
  const members = useMembers();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown =
    Array.isArray(members) && q
      ? members.filter((m) =>
          `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase().includes(q),
        )
      : Array.isArray(members)
        ? members
        : [];

  return (
    <div className="flex flex-col gap-4">
      {members === null && <p className="text-base text-fg-muted">Loading members…</p>}
      {Array.isArray(members) && (
        <div className="flex flex-col gap-2">
          <p className="field-label text-lg font-medium text-fg">
            Community members{picked.size > 0 && ` · ${picked.size} picked`}
          </p>
          <SearchField
            label="Search members"
            placeholder="Search by name or email"
            value={query}
            onChange={setQuery}
          />
          <ul className="max-h-64 overflow-y-auto rounded-control border border-line bg-surface">
            {shown.length === 0 ? (
              <li className="px-4 py-3 text-base text-fg-muted">No members match.</li>
            ) : (
              shown.map((m) => {
                const email = m.email!;
                const on = picked.has(email);
                return (
                  <li key={m.id} className="border-b border-line/60 last:border-b-0">
                    <Checkbox
                      className="w-full px-4 py-2 hover:bg-surface-subtle"
                      label={`${m.first_name} ${m.last_name} · ${email}`}
                      checked={on}
                      onChange={() => {
                        const next = new Set(picked);
                        if (on) next.delete(email);
                        else next.add(email);
                        onPick(next);
                      }}
                    />
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
      <Field
        label={
          Array.isArray(members)
            ? "Anyone else, by email (optional)"
            : "Add community members by email (optional)"
        }
      >
        <TextArea
          rows={3}
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder={"one@example.com\nanother@example.com"}
        />
      </Field>
      <p className="text-base text-fg-muted">
        One per line or separated by commas. Everyone is added straight away,
        with no approval; anyone without an account is invited to make one.
      </p>
    </div>
  );
}

/** What adding people did, in a few lines. */
function PeopleSummary({ people }: { people: AddPeopleResult }) {
  const { added, invited, already, invalid } = people;
  const lines = [
    added.length > 0 && `${added.length} in the group now`,
    invited.length > 0 &&
      `${invited.length} invited to create an account (they join when they do)`,
    already.length > 0 && `${already.length} already in`,
    invalid.length > 0 && `${invalid.length} not an email address: ${invalid.join(", ")}`,
  ].filter(Boolean) as string[];
  return (
    <>
      <ul className="mt-4 flex list-disc flex-col gap-1 pl-5 text-lg text-fg">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="mt-4 text-base text-fg-muted">Everyone added gets an email.</p>
    </>
  );
}

/**
 * "New group" as a dialog: the group's name and, optionally, who's in it —
 * existing members checked off (superadmins) and/or email addresses — added
 * with no approval (`POST /access-groups/{id}/people`). The new group is
 * picked for the event as soon as it's made.
 */
function NewGroupModal({
  hostId,
  onClose,
  onCreated,
}: {
  hostId: string;
  onClose: () => void;
  onCreated: (group: AccessGroup) => void;
}) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ group: AccessGroup; people: AddPeopleResult } | null>(
    null,
  );
  const emails = Array.from(new Set([...picked, ...typedEmails(text)]));

  async function create() {
    if (!name.trim()) return;
    if (emails.length > 50) {
      setError("Add up to 50 people at a time — you can add more with Add members after.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const group = await createAccessGroup(name.trim(), hostId);
      onCreated(group);
      if (emails.length === 0) {
        onClose();
        return;
      }
      try {
        setResult({ group, people: await addPeopleToGroup(group.id, emails) });
      } catch (e) {
        // The group exists and is chosen; only the people didn't go in.
        setError(
          apiMessage(e, "The group was made, but those people couldn't be added. Try Add members."),
        );
      }
    } catch (e) {
      setError(apiMessage(e, "Couldn't create that group. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Modal title={`${result.group.name} is ready`} onClose={onClose}>
        <PeopleSummary people={result.people} />
        <p className="mt-2 text-base text-fg-muted">The group is set for this event.</p>
        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="New special access group"
      subtitle="Only members in this group will see the event in their feed."
      onClose={onClose}
    >
      <div className="mt-6 flex flex-col gap-4">
        <TextField
          label="Group name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Residential program"
          autoComplete="off"
          autoFocus
          onKeyDown={(e) => {
            // Enter here makes the group, not the whole event form behind it.
            if (e.key === "Enter") {
              e.preventDefault();
              if (name.trim() && !busy) void create();
            }
          }}
        />
        <PeopleFields picked={picked} onPick={setPicked} text={text} onText={setText} />
        {error && (
          <p role="alert" className="text-base text-danger-fg">
            {error}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim() || busy}
            onClick={() => void create()}
          >
            {busy ? "Creating…" : emails.length > 0 ? `Create and add ${emails.length}` : "Create group"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** "Add members" to the group already chosen for the event. */
function AddMembersModal({
  group,
  groupId,
  onClose,
}: {
  group: AccessGroup | null;
  groupId: string;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddPeopleResult | null>(null);
  const emails = Array.from(new Set([...picked, ...typedEmails(text)]));
  const name = group?.name ?? "this group";

  async function add() {
    if (emails.length === 0) return;
    if (emails.length > 50) {
      setError("Add up to 50 people at a time.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await addPeopleToGroup(groupId, emails));
    } catch (e) {
      setError(apiMessage(e, "Couldn't add those people. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Modal title={`Added to ${name}`} onClose={onClose}>
        <PeopleSummary people={result} />
        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Add members to ${name}`}
      subtitle="They'll see this event, and the group's other events, in their feed."
      onClose={onClose}
    >
      <div className="mt-6 flex flex-col gap-4">
        <PeopleFields picked={picked} onPick={setPicked} text={text} onText={setText} />
        {error && (
          <p role="alert" className="text-base text-danger-fg">
            {error}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={emails.length === 0 || busy}
            onClick={() => void add()}
          >
            {busy ? "Adding…" : emails.length > 0 ? `Add ${emails.length}` : "Add"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
