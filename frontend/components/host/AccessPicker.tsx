"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  apiMessage,
  createAccessGroup,
  fetchAccessGroups,
  type AccessGroup,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { TextField } from "@/components/ui/TextField";
import { Field, Select } from "@/components/AdminTable";

export type AccessMode = "everyone" | "group";

/**
 * "Who can see this": everyone, or only members approved into one of the
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
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const g = await createAccessGroup(newName.trim(), hostId);
      setGroups((cur) => [...(cur ?? []), g].sort((a, b) => a.name.localeCompare(b.name)));
      onChange("group", g.id);
      setNewName("");
      setAdding(false);
    } catch (e) {
      setError(apiMessage(e, "Couldn't create that group. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <SegmentedToggle<AccessMode>
        label="Who can see this"
        value={mode}
        onChange={(next) => onChange(next, next === "group" ? groupId : null)}
        segments={[
          { value: "everyone", label: "Everyone" },
          { value: "group", label: "Special access" },
        ]}
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
            <div className="flex flex-wrap items-end gap-3 rounded-control border border-line bg-surface-subtle p-4">
              <TextField
                label="New group name"
                className="min-w-[240px] flex-1 sm:max-w-[420px]"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Residential program"
                autoComplete="off"
                autoFocus
                onKeyDown={(e) => {
                  // Enter here creates the group, not the whole program.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (newName.trim() && !busy) void create();
                  }
                }}
              />
              <Button
                variant="primary"
                className="min-h-12"
                disabled={!newName.trim() || busy}
                onClick={() => void create()}
              >
                {busy ? "Creating…" : "Create"}
              </Button>
              <Button
                variant="ghost"
                className="min-h-12"
                disabled={busy}
                onClick={() => {
                  setAdding(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              {error && (
                <p role="alert" className="w-full text-base text-danger-fg">
                  {error}
                </p>
              )}
            </div>
          )}

          <p className="text-base text-fg-muted">
            Only members approved into this group find the program in the feed.
            Anyone with the link or the QR code can still open its page and ask
            to join.
          </p>
        </div>
      )}
    </div>
  );
}
