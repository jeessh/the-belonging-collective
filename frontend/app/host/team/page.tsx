"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, SendHorizontal, Trash2 } from "lucide-react";
import {
  ApiError,
  apiMessage,
  fetchTeam,
  inviteStaff,
  listAdmins,
  removeStaff,
  revokeInvite,
  type AdminAccount,
  type Team,
} from "@/lib/api";
import { AdminShell, type ConsoleContext } from "@/components/AdminShell";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { EmptyRow, Field, Pill, Select, TableCard } from "@/components/AdminTable";
import { Modal } from "@/components/Modal";

/**
 * Team: who can sign in for this organization.
 *
 * An agency may keep the one shared login it started with, add a login per
 * staff member, or both — the shared login and the staff logins sit in the
 * same table and do the same things. Adding someone sends them an invitation;
 * they choose their own password, so nobody here ever knows it.
 */
export default function TeamPage() {
  return <AdminShell>{(ctx) => <TeamView ctx={ctx} />}</AdminShell>;
}

function TeamView({ ctx }: { ctx: ConsoleContext }) {
  const router = useRouter();
  const { show } = useToast();
  // A superadmin may look at any organization's team; everyone else sees
  // their own. Undefined = own.
  const [orgId, setOrgId] = useState<string | undefined>(undefined);
  const [orgs, setOrgs] = useState<AdminAccount[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [removing, setRemoving] = useState<Team["staff"][number] | null>(null);

  async function load() {
    try {
      setTeam(await fetchTeam(orgId));
      setLoadError(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/host");
        return;
      }
      setLoadError(true);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    if (ctx.isSuper)
      listAdmins()
        .then(setOrgs)
        .catch(() => {});
  }, [ctx.isSuper]);

  const org = team?.org ?? ctx.org;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-[840px] flex-col gap-3">
          <h1 className="text-4xl font-medium text-fg sm:text-5xl">Team</h1>
          <p className="text-xl text-fg">
            Everyone who can sign in for {org.name}. Use the shared login, give
            each person their own, or both. Every login can post and manage
            your programs.
          </p>
        </div>
        {ctx.isSuper && orgs.length > 0 && (
          <Field label="Organization" className="w-full sm:w-80">
            <Select
              value={orgId ?? ctx.org.id}
              onChange={(e) =>
                setOrgId(
                  e.target.value === ctx.org.id ? undefined : e.target.value,
                )
              }
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <InviteStaffForm
        orgId={org.id}
        orgName={org.name}
        onSent={() => void load()}
      />

      {loadError ? (
        <p role="alert" className="text-lg text-danger-fg">
          Couldn&apos;t load the team. Please refresh and try again.
        </p>
      ) : (
        <TableCard
          caption={`Logins for ${org.name}: the shared login, each staff member, and invitations still waiting.`}
          head={["Name", "Email", "Status", ""]}
        >
          {!team ? (
            <EmptyRow colSpan={4} text="Loading…" />
          ) : (
            <>
              <tr className="align-middle">
                <th scope="row" className="px-3 py-3 font-normal">
                  <span className="inline-flex items-center gap-3">
                    <Avatar name={team.org.name} />
                    {team.org.name}
                    {ctx.me.id === team.org.id && <Pill tone="good">You</Pill>}
                  </span>
                </th>
                <td className="whitespace-nowrap px-3 py-3">
                  {team.org.email}
                </td>
                <td className="px-3 py-3">
                  <Pill tone="neutral">Shared login</Pill>
                </td>
                <td className="px-3 py-3" />
              </tr>
              {team.staff.map((s) => (
                <tr key={s.id} className="align-middle">
                  <th scope="row" className="px-3 py-3 font-normal">
                    <span className="inline-flex items-center gap-3">
                      <Avatar name={s.name} />
                      {s.name}
                      {ctx.me.id === s.id && <Pill tone="good">You</Pill>}
                    </span>
                  </th>
                  <td className="whitespace-nowrap px-3 py-3">{s.email}</td>
                  <td className="px-3 py-3">
                    <Pill tone="neutral">Staff</Pill>
                  </td>
                  <td className="px-3 py-3">
                    {/* The API refuses removing your own login. */}
                    {ctx.me.id !== s.id && (
                      <span className="flex justify-end">
                        <Button
                          variant="ghost"
                          aria-label={`Remove ${s.name}`}
                          title="Remove"
                          onClick={() => setRemoving(s)}
                          style={{ color: "#CC0000" }}
                          leadingIcon={<Trash2 />}
                        />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {team.invites.map((inv) => (
                <tr key={inv.id} className="align-middle text-fg-muted">
                  <th scope="row" className="px-3 py-3 font-normal">
                    <span className="inline-flex items-center gap-3">
                      <Avatar />
                      {inv.name}
                    </span>
                  </th>
                  <td className="whitespace-nowrap px-3 py-3">{inv.email}</td>
                  <td className="px-3 py-3">
                    <Pill tone={inv.expired ? "warn" : "neutral"}>
                      {inv.expired ? "Invite expired" : "Invited"}
                    </Pill>
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex justify-end">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          void revokeInvite(inv.id)
                            .then(() => {
                              show({
                                title: `Withdrew the invitation for ${inv.name}.`,
                              });
                              void load();
                            })
                            .catch((e) =>
                              show({
                                title: apiMessage(
                                  e,
                                  "Couldn't withdraw that invitation.",
                                ),
                                tone: "alert",
                              }),
                            );
                        }}
                      >
                        Withdraw
                        <span className="sr-only">
                          {" "}
                          invitation for {inv.name}
                        </span>
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </>
          )}
        </TableCard>
      )}

      {removing && (
        <RemoveStaffModal
          staff={removing}
          orgName={org.name}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            setRemoving(null);
            show({ title: `Removed ${removing.name}.`, tone: "alert" });
            void load();
          }}
        />
      )}
    </div>
  );
}

/** Name + email → an invitation by mail, with the link to copy if it doesn't arrive. */
function InviteStaffForm({
  orgId,
  orgName,
  onSent,
}: {
  orgId: string;
  orgName: string;
  onSent: () => void;
}) {
  const { show } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{
    name: string;
    email: string;
    url: string;
  } | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const inv = await inviteStaff({
        org_id: orgId,
        name: name.trim(),
        email: email.trim(),
      });
      setSent({
        name: inv.name,
        email: inv.email,
        url: `${window.location.origin}/host/invite/${inv.token}`,
      });
      setName("");
      setEmail("");
      onSent();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 422
          ? "Check the name and email address."
          : apiMessage(e, "Couldn't send that invitation."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex max-w-[1026px] flex-col gap-3">
      <div>
        <h2 className="text-xl font-medium text-fg">Add staff</h2>
        <p className="text-xl text-fg">
          They get an email with a link, choose their own password, and sign in
          as {orgName}.
        </p>
      </div>

      {sent && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-control border-[3px] border-toast-success bg-tag-free-bg px-5 py-3 text-lg text-fg"
        >
          <span className="flex-1">
            Invitation sent to <strong>{sent.email}</strong> for {sent.name}. It
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
            Add another
          </Button>
        </div>
      )}

      <form
        className="flex flex-col gap-4 sm:flex-row sm:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && name.trim() && email.trim()) void send();
        }}
      >
        <TextField
          label="Name"
          className="flex-1 [&>label]:sr-only"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Their name"
          autoComplete="off"
        />
        <TextField
          label="Email"
          className="flex-1 [&>label]:sr-only"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Their email"
          autoComplete="off"
        />
        <Button
          type="submit"
          variant="secondary"
          className="min-h-12"
          disabled={busy || !name.trim() || !email.trim()}
          trailingIcon={<SendHorizontal />}
        >
          {busy ? "Sending…" : "Send invite"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-base text-danger-fg">
          {error}
        </p>
      )}
    </section>
  );
}

function RemoveStaffModal({
  staff,
  orgName,
  onClose,
  onRemoved,
}: {
  staff: Team["staff"][number];
  orgName: string;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await removeStaff(staff.id);
      onRemoved();
    } catch (e) {
      setError(apiMessage(e, "Couldn't remove that login. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal
      tone="danger"
      onClose={onClose}
      title={
        <>
          <p className="text-2xl text-fg">Remove this login?</p>
          <p className="mt-1 text-2xl font-medium italic text-fg">
            {staff.name}
          </p>
        </>
      }
    >
      <p className="mt-3 text-lg text-fg-muted">
        They won&apos;t be able to sign in. Everything else at {orgName} stays,
        including the programs they posted.
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
