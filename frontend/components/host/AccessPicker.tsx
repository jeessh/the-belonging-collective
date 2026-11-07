"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  addPeopleToGroup,
  apiMessage,
  createAccessGroup,
  fetchAccessGroups,
  type AccessGroup,
  type AddPeopleResult,
} from "@/lib/api";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { TextField } from "@/components/ui/TextField";
import { Field, Select, TextArea } from "@/components/AdminTable";

export type AccessMode = "everyone" | "group";

/**
 * "Who can see this": a Special access checkbox — unticked, everyone; ticked,
 * the group picker below it. Only members approved into one of the
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
    <div className="flex flex-col items-start gap-4">
      {/* Unticked, everyone can see it; ticked, the group picker shows. */}
      <Checkbox
        label="Special access: only members approved into a group can see it"
        checked={mode === "group"}
        onChange={(e) =>
          e.target.checked ? onChange("group", groupId) : onChange("everyone", null)
        }
      />

      {mode === "group" && (
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Group" required className="min-w-[240px] flex-1 sm:max-w-[420px]">
              <Select
                value={groupId ?? ""}
                onChange={(e) => onChange("group", e.target.value || null)}
                disabled={groups === null}
              >
                <option value="">
                  {groups === null ? "Loading…" : "Choose a group"}
                </option>
                {(groups ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
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

          <p className="text-base text-fg-muted">
            Only approved members see it in the feed. Anyone with the link or
            QR code can still open its page and ask to join.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * "New group" as a dialog: the group's name and, optionally, the community
 * members to put in it, by email — added straight away with no approval
 * (`POST /access-groups/{id}/people`): an address with an account is in at
 * once, one without is invited and joins when they sign up. The new group
 * is picked for the event as soon as it's made.
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
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ group: AccessGroup; people: AddPeopleResult } | null>(
    null,
  );

  const emails = text
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  async function create() {
    if (!name.trim()) return;
    if (emails.length > 50) {
      setError("Add up to 50 addresses at a time — you can add more from Special Access later.");
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
          apiMessage(
            e,
            "The group was made, but those people couldn't be added. Add them from Special Access.",
          ),
        );
      }
    } catch (e) {
      setError(apiMessage(e, "Couldn't create that group. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const { added, invited, already, invalid } = result.people;
    const lines = [
      added.length > 0 && `${added.length} in the group now`,
      invited.length > 0 && `${invited.length} invited to create an account (they join when they do)`,
      already.length > 0 && `${already.length} already in`,
      invalid.length > 0 && `${invalid.length} not an email address: ${invalid.join(", ")}`,
    ].filter(Boolean) as string[];
    return (
      <Modal title={`${result.group.name} is ready`} onClose={onClose}>
        <ul className="mt-4 flex list-disc flex-col gap-1 pl-5 text-lg text-fg">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="mt-4 text-base text-fg-muted">
          Everyone added gets an email. The group is set for this event.
        </p>
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
        <Field label="Add community members (optional)">
          <TextArea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"one@example.com\nanother@example.com"}
          />
        </Field>
        <p className="text-base text-fg-muted">
          Their email addresses, one per line or separated by commas (up to 50).
          They're added straight away, with no approval; anyone without an
          account is invited to make one.
        </p>
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
