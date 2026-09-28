"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  ApiError,
  apiMessage,
  archiveCategory,
  createCategory,
  updateCategory,
  type CategoryRow,
} from "@/lib/api";
import { categoryStyle, invalidateCategories, loadCategories } from "@/lib/categories";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { EmptyRow, Pill, TableCard } from "@/components/AdminTable";
import { Modal } from "@/components/Modal";
import { AccountsNav } from "@/components/host/AccountsNav";

/**
 * The topic list — what members pick as interests and hosts file programs
 * under. A topic's slug never changes, so renaming here breaks no match;
 * archiving one that programs still use asks where they should go and moves
 * them (and members' interests) in the same request.
 */
export default function TopicsPage() {
  return (
    <AdminShell requireSuperadmin>
      {() => <Topics />}
    </AdminShell>
  );
}

function Topics() {
  const router = useRouter();
  const { show } = useToast();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ slug: string; label: string } | null>(null);
  const [archiving, setArchiving] = useState<CategoryRow | null>(null);

  async function load() {
    try {
      invalidateCategories();
      setRows(await loadCategories());
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

  async function act(slug: string, work: () => Promise<unknown>, fallback: string) {
    setBusy(slug);
    try {
      await work();
      await load();
    } catch (e) {
      show({ title: apiMessage(e, fallback), tone: "alert" });
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    const label = newLabel.trim();
    if (!label) return;
    setAddError(null);
    setBusy("new");
    try {
      const made = await createCategory(label);
      setNewLabel("");
      show({ title: `Added ${made.label}.` });
      await load();
    } catch (e) {
      setAddError(apiMessage(e, "Couldn't add that topic. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  function rename() {
    if (!editing) return;
    const label = editing.label.trim();
    if (!label) return;
    const { slug } = editing;
    setEditing(null);
    void act(
      slug,
      () => updateCategory(slug, { label }),
      "Couldn't rename that topic. Please try again.",
    );
  }

  // Swap sort_order with the neighbour. Two PATCHes; the list re-reads after.
  function move(index: number, dir: -1 | 1) {
    const a = rows[index];
    const b = rows[index + dir];
    if (!a || !b) return;
    void act(
      a.slug,
      () =>
        Promise.all([
          updateCategory(a.slug, { sort_order: b.sort_order }),
          updateCategory(b.slug, { sort_order: a.sort_order }),
        ]),
      "Couldn't reorder. Please try again.",
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <AccountsNav />

      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-medium text-fg sm:text-5xl">Topics</h1>
        <p className="text-xl text-fg">
          What members pick as interests and organizations file programs under.
          Renaming a topic keeps every match; archiving one moves its programs
          to a topic you choose.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <TextField
          label="New topic"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="e.g. Volunteering"
          maxLength={60}
          error={addError}
          className="w-full sm:w-80"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={busy === "new" || !newLabel.trim()}
          trailingIcon={<Plus />}
        >
          Add topic
        </Button>
      </form>

      {loadError ? (
        <p role="alert" className="text-lg text-danger-fg">
          Couldn&apos;t load topics. Please refresh and try again.
        </p>
      ) : (
        <TableCard
          caption="Topics in the order members and hosts see them, with how many live programs use each."
          head={["Order", "Topic", "Programs", ""]}
        >
          {loading ? (
            <EmptyRow colSpan={4} text="Loading…" />
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={4} text="No topics yet." />
          ) : (
            rows.map((c, i) => {
              const isBusy = busy !== null;
              const isEditing = editing?.slug === c.slug;
              return (
                <tr key={c.slug} className="align-middle">
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        aria-label={`Move ${c.label} up`}
                        disabled={isBusy || i === 0}
                        onClick={() => move(i, -1)}
                        leadingIcon={<ArrowUp />}
                      />
                      <Button
                        variant="ghost"
                        aria-label={`Move ${c.label} down`}
                        disabled={isBusy || i === rows.length - 1}
                        onClick={() => move(i, 1)}
                        leadingIcon={<ArrowDown />}
                      />
                    </span>
                  </td>
                  <th scope="row" className="px-3 py-3 font-normal">
                    {isEditing ? (
                      <form
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          rename();
                        }}
                      >
                        <input
                          aria-label={`New name for ${c.label}`}
                          autoFocus
                          value={editing.label}
                          maxLength={60}
                          onChange={(e) =>
                            setEditing({ slug: c.slug, label: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="min-h-12 rounded-field border border-line bg-surface px-4 py-2 text-lg text-fg"
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          aria-label="Save name"
                          disabled={!editing.label.trim()}
                          leadingIcon={<Check />}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label="Cancel rename"
                          onClick={() => setEditing(null)}
                          leadingIcon={<X />}
                        />
                      </form>
                    ) : (
                      <span className="inline-flex items-center gap-3">
                        <span aria-hidden="true">{categoryStyle(c.slug).emoji}</span>
                        {c.label}
                        <span className="text-base text-fg-muted">{c.slug}</span>
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-3">
                    <Pill tone={c.event_count ? "neutral" : "warn"}>
                      {c.event_count}
                    </Pill>
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        aria-label={`Rename ${c.label}`}
                        title="Rename"
                        disabled={isBusy || isEditing}
                        onClick={() => setEditing({ slug: c.slug, label: c.label })}
                        leadingIcon={<Pencil />}
                      />
                      <Button
                        variant="ghost"
                        aria-label={`Archive ${c.label}`}
                        title="Archive"
                        disabled={isBusy}
                        onClick={() => setArchiving(c)}
                        style={{ color: "#CC0000" }}
                        leadingIcon={<Trash2 />}
                      />
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </TableCard>
      )}

      {archiving && (
        <ArchiveModal
          topic={archiving}
          others={rows.filter((c) => c.slug !== archiving.slug)}
          onClose={() => setArchiving(null)}
          onDone={(moved, to) => {
            setArchiving(null);
            show({
              title: `Archived ${archiving.label}.`,
              description:
                moved > 0 && to
                  ? `${moved} ${moved === 1 ? "program" : "programs"} moved to ${to}.`
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

function ArchiveModal({
  topic,
  others,
  onClose,
  onDone,
}: {
  topic: CategoryRow;
  others: CategoryRow[];
  onClose: () => void;
  onDone: (movedEvents: number, toLabel: string | null) => void;
}) {
  const needsTarget = topic.event_count > 0;
  const [target, setTarget] = useState(needsTarget ? others[0]?.slug ?? "" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await archiveCategory(topic.slug, target || undefined);
      onDone(
        result.affected_events,
        others.find((c) => c.slug === result.reassigned_to)?.label ?? null,
      );
    } catch (e) {
      setError(apiMessage(e, "Couldn't archive that topic. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      title={
        <>
          <p className="text-2xl text-fg">Archive this topic?</p>
          <p className="mt-1 text-2xl font-medium italic text-fg">{topic.label}</p>
        </>
      }
    >
      <p className="mt-3 text-lg text-fg-muted">
        {needsTarget ? (
          <>
            <strong className="text-fg">
              {topic.event_count} live {topic.event_count === 1 ? "program is" : "programs are"}
            </strong>{" "}
            filed under it. Choose where they go; members interested in{" "}
            {topic.label} move with them.
          </>
        ) : (
          "No live programs use it. Members who picked it as an interest lose that pick."
        )}
      </p>
      {needsTarget && (
        <label className="mt-4 flex flex-col gap-1 text-lg font-medium text-fg">
          Move programs to
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="min-h-12 rounded-field border border-line bg-surface px-4 py-3 text-lg font-normal text-fg"
          >
            {others.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p role="alert" className="mt-3 text-base text-danger-fg">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={busy || (needsTarget && !target)}
          onClick={() => void submit()}
        >
          Archive topic
        </Button>
      </div>
    </Modal>
  );
}
