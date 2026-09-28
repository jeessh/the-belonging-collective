"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Link2,
  Trash2,
  UserPlus,
  UserRoundX,
} from "lucide-react";
import {
  ApiError,
  api,
  apiMessage,
  createShareLink,
  removeCaregiver,
  sharedListUrl,
  shortName,
  unlinkCareMember,
  updateMe,
  uploadAvatar,
  type CarePerson,
  type Me,
} from "@/lib/api";
import { EMBLEMS } from "@/lib/emblems";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/Modal";
import { CareLinkForm, type CareLinkResult } from "@/components/member/CareLinkForm";

const CARD = "flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6";
const HEADING = "text-lg uppercase tracking-wide text-fg-muted";

/**
 * The member's own settings: email, picture, list link, and the people on
 * either side of a care link. Small on purpose — labels, not explanations,
 * and one card per thing.
 */
export default function ProfilePage() {
  const router = useRouter();
  const { show } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [busy, setBusy] = useState<
    "email" | "picture" | "link" | "care" | null
  >(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  // The caregiver's add / link sheet, and the key it hands back.
  const [careForm, setCareForm] = useState<"create" | "link" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    api<Me>("/users/me")
      .then((res) => {
        if (!alive) return;
        setMe(res);
        setEmail(res.email ?? "");
      })
      .catch((e) => {
        if (!alive) return;
        // Signed out: sign in, then come back here.
        if (e instanceof ApiError && e.status === 401) {
          router.replace(`/signup?next=${encodeURIComponent("/profile")}`);
        }
      });
    return () => {
      alive = false;
    };
  }, [router]);

  async function saveEmail(e: FormEvent) {
    e.preventDefault();
    if (!me) return;
    setBusy("email");
    setEmailError(null);
    try {
      const next = email.trim();
      setMe(await updateMe({ email: next ? next : null }));
      show({ title: next ? "Email saved" : "Email removed" });
    } catch (err) {
      setEmailError(apiMessage(err, "That didn't save. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setBusy("picture");
    setPictureError(null);
    try {
      setMe(await uploadAvatar(file));
      show({ title: "Photo saved" });
    } catch (err) {
      setPictureError(apiMessage(err, "That didn't upload. Please try again."));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function pickEmblem(slug: string | null) {
    setBusy("picture");
    setPictureError(null);
    try {
      setMe(
        await updateMe(
          slug ? { avatar_emblem: slug } : { avatar_emblem: null, avatar_url: null },
        ),
      );
      show({ title: slug ? "Emblem saved" : "Picture removed" });
    } catch (err) {
      setPictureError(apiMessage(err, "That didn't save. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    setBusy("link");
    try {
      const url = linkUrl ?? sharedListUrl((await createShareLink()).token);
      setLinkUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        show({ title: "Link copied" });
      } catch {
        // The URL is on screen; they can select it.
      }
    } catch (err) {
      show({ title: apiMessage(err, "Couldn't make the link."), tone: "alert" });
    } finally {
      setBusy(null);
    }
  }

  async function toggleCaregiver(on: boolean) {
    setBusy("care");
    try {
      setMe(await updateMe({ is_caregiver: on }));
      show({ title: on ? "You're a caregiver" : "Caregiver tools off" });
    } catch (err) {
      show({ title: apiMessage(err, "That didn't save."), tone: "alert" });
    } finally {
      setBusy(null);
    }
  }

  // The lists live on the profile; re-read it after any change to a link.
  async function reload() {
    try {
      setMe(await api<Me>("/users/me"));
    } catch {
      /* the next visit picks it up */
    }
  }

  function careDone(result: CareLinkResult) {
    setCareForm(null);
    show({ title: `Linked ${shortName(result.person)}` });
    void reload();
  }

  async function unlink(member: CarePerson) {
    setBusy("care");
    try {
      await unlinkCareMember(member.id);
      show({ title: `Unlinked ${shortName(member)}`, tone: "info" });
      await reload();
    } catch (err) {
      show({ title: apiMessage(err, "Couldn't unlink."), tone: "alert" });
    } finally {
      setBusy(null);
    }
  }

  async function dropCaregiver(person: CarePerson) {
    setBusy("care");
    try {
      await removeCaregiver(person.id);
      show({ title: `Removed ${shortName(person)}`, tone: "info" });
      await reload();
    } catch (err) {
      show({ title: apiMessage(err, "Couldn't remove them."), tone: "alert" });
    } finally {
      setBusy(null);
    }
  }

  if (!me) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface-subtle text-fg-muted">
        <p className="text-2xl">Loading…</p>
      </main>
    );
  }

  const name = `${me.first_name} ${me.last_name}`;
  // The same short form the feed header uses, so the initials keep one colour.
  const short = shortName(me);
  const hasPicture = !!(me.avatar_url || me.avatar_emblem);

  return (
    <main className="min-h-dvh bg-surface-subtle px-4 py-6 text-fg sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-medium">Profile</h1>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-lg text-fg underline underline-offset-4 hover:bg-surface"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
            Back to programs
          </Link>
        </div>

        <section className={`${CARD} flex-row items-center gap-5`} aria-labelledby="name-h">
          <Avatar name={short} src={me.avatar_url} emblem={me.avatar_emblem} size={72} />
          <div className="min-w-0">
            <h2 id="name-h" className={HEADING}>
              Name
            </h2>
            <p className="truncate text-2xl">{name}</p>
          </div>
        </section>

        <form onSubmit={saveEmail} className={CARD} aria-labelledby="email-h">
          <h2 id="email-h" className={HEADING}>
            Email
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <TextField
              label="Sign-in email"
              placeholder="Enter your email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              className="flex-1"
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={busy === "email" || email.trim() === (me.email ?? "")}
            >
              Save
            </Button>
          </div>
        </form>

        <section className={CARD} aria-labelledby="picture-h">
          <h2 id="picture-h" className={HEADING}>
            Profile picture
          </h2>
          <div className="flex flex-wrap gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => void pickPhoto(e.target.files?.[0])}
            />
            <Button
              size="lg"
              leadingIcon={<Camera />}
              disabled={busy === "picture"}
              onClick={() => fileRef.current?.click()}
            >
              Upload photo
            </Button>
            {hasPicture && (
              <Button
                size="lg"
                variant="danger"
                leadingIcon={<Trash2 />}
                disabled={busy === "picture"}
                onClick={() => void pickEmblem(null)}
              >
                Remove
              </Button>
            )}
          </div>
          <div
            role="group"
            aria-label="Choose an emblem"
            className="grid grid-cols-4 gap-3 sm:grid-cols-8"
          >
            {EMBLEMS.map(({ slug, emoji, label }) => {
              const pressed = me.avatar_emblem === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  aria-label={label}
                  aria-pressed={pressed}
                  disabled={busy === "picture"}
                  onClick={() => void pickEmblem(slug)}
                  className={`grid aspect-square min-h-12 place-items-center rounded-control border text-3xl transition-colors ${
                    pressed
                      ? "border-primary-border bg-primary-soft"
                      : "border-line bg-surface hover:bg-surface-subtle"
                  }`}
                >
                  <span aria-hidden="true">{emoji}</span>
                </button>
              );
            })}
          </div>
          {pictureError && (
            <p role="alert" className="text-base text-danger-fg">
              {pictureError}
            </p>
          )}
        </section>

        <section className={CARD} aria-labelledby="share-h">
          <h2 id="share-h" className={HEADING}>
            Share my list
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {linkUrl && (
              <p className="flex-1 select-text break-all rounded-field border border-line bg-surface-subtle px-4 py-3 text-lg text-fg-muted">
                {linkUrl}
              </p>
            )}
            <Button
              size="lg"
              leadingIcon={<Link2 />}
              disabled={busy === "link"}
              onClick={() => void copyLink()}
            >
              Copy link
            </Button>
          </div>
        </section>

        {/* Care links. Support, not proxy: the people listed keep their own
            accounts; a link only lets the caregiver save into their list. */}
        <section className={CARD} aria-labelledby="caregiver-h">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="caregiver-h" className={HEADING}>
                Caregiver
              </h2>
              <p className="text-lg text-fg">I&apos;m a caregiver</p>
              <p className="text-base text-fg-muted">
                Save programs for someone you support.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={me.is_caregiver}
              aria-label="I'm a caregiver"
              disabled={busy === "care"}
              onClick={() => void toggleCaregiver(!me.is_caregiver)}
              className="grid size-11 shrink-0 place-items-center disabled:opacity-40"
            >
              <span
                className={`relative block h-6 w-11 rounded-full transition-colors ${
                  me.is_caregiver ? "bg-primary-strong" : "bg-line"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
                    me.is_caregiver ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          </div>

          {me.is_caregiver && (
            <div className="flex flex-col gap-4 border-t border-line-card pt-4">
              <h3 className="text-lg font-medium text-fg">People I support</h3>
              {me.care.length === 0 ? (
                <p className="text-base text-fg-muted">Nobody linked yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line-card">
                  {me.care.map((person) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      action="Unlink"
                      disabled={busy === "care"}
                      onAction={() => void unlink(person)}
                    />
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  variant="primary"
                  leadingIcon={<UserPlus />}
                  onClick={() => setCareForm("create")}
                >
                  Create their account
                </Button>
                <Button
                  size="lg"
                  leadingIcon={<Link2 />}
                  onClick={() => setCareForm("link")}
                >
                  Link an account
                </Button>
              </div>
            </div>
          )}
        </section>

        {me.caregivers.length > 0 && (
          <section className={CARD} aria-labelledby="supporters-h">
            <h2 id="supporters-h" className={HEADING}>
              People who support me
            </h2>
            <p className="text-base text-fg-muted">
              They can see your saved events and save programs for you.
            </p>
            <ul className="flex flex-col divide-y divide-line-card">
              {me.caregivers.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  action="Remove"
                  disabled={busy === "care"}
                  onAction={() => void dropCaregiver(person)}
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      {careForm && (
        <Modal
          title={careForm === "create" ? "Their account" : "Link their account"}
          onClose={() => setCareForm(null)}
        >
          <p className="mt-2 text-lg text-fg-muted">
            {careForm === "create"
              ? "Their name, email and a password. It is theirs to sign in with."
              : "Enter what they use to sign in."}
          </p>
          <div className="mt-6">
            <CareLinkForm
              mode={careForm}
              onDone={careDone}
              onCancel={() => setCareForm(null)}
              cancelLabel="Cancel"
            />
          </div>
        </Modal>
      )}

    </main>
  );
}

/** One linked person: picture, name, and the one thing you can do about it. */
function PersonRow({
  person,
  action,
  disabled,
  onAction,
}: {
  person: CarePerson;
  action: "Unlink" | "Remove";
  disabled: boolean;
  onAction: () => void;
}) {
  const label = shortName(person);
  return (
    <li className="flex items-center gap-4 py-3">
      <Avatar name={label} src={person.avatar_url} emblem={person.avatar_emblem} size={40} />
      <span className="min-w-0 flex-1 truncate text-lg text-fg">{label}</span>
      <Button
        variant="ghost"
        leadingIcon={<UserRoundX />}
        disabled={disabled}
        onClick={onAction}
        aria-label={`${action} ${label}`}
      >
        {action}
      </Button>
    </li>
  );
}
