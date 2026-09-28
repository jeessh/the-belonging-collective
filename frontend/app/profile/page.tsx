"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
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
  disconnectGoogleCalendar,
  removeCaregiver,
  sharedListUrl,
  shortName,
  unlinkCareMember,
  updateMe,
  uploadAvatar,
  type CarePerson,
  type Me,
} from "@/lib/api";
import { googleCalendarButton } from "@/lib/calendar";
import { EMBLEMS } from "@/lib/emblems";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClass } from "@/components/ui/Button";
import { GoogleCalendarIcon } from "@/components/ui/GoogleCalendarIcon";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/Modal";
import { CareLinkForm, type CareLinkResult } from "@/components/member/CareLinkForm";

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
    "email" | "picture" | "link" | "care" | "calendar" | null
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

  async function disconnectCalendar() {
    setBusy("calendar");
    try {
      await disconnectGoogleCalendar();
      setMe((m) => (m ? { ...m, google_calendar: "available" } : m));
      show({ title: "Google Calendar disconnected", tone: "info" });
    } catch (err) {
      show({ title: apiMessage(err, "Couldn't disconnect."), tone: "alert" });
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
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-medium sm:text-3xl">Profile</h1>
          <Link href="/" className={buttonClass("secondary")}>
            <ArrowLeft aria-hidden="true" className="size-6" />
            Back to programs
          </Link>
        </div>

        <Card
          title={name}
          subtitle={me.is_caregiver ? "Caregiver" : "Community member"}
          lead={
            <Avatar name={short} src={me.avatar_url} emblem={me.avatar_emblem} size={72} />
          }
        />

        <Card
          as="form"
          onSubmit={saveEmail}
          title="Email"
          subtitle="You log in with it, and reminders for saved events go there."
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
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
        </Card>

        <Card
          title="Profile picture"
          subtitle="Upload a photo or pick an emblem."
        >
          <div className="flex flex-wrap gap-4">
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
            <p role="alert" className="text-lg text-danger-fg">
              {pictureError}
            </p>
          )}
        </Card>

        <Card
          title="Share my list"
          subtitle="Anyone with the link can see your upcoming saved events."
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {linkUrl && (
              <p className="flex-1 select-text break-all rounded-control border border-line bg-surface-subtle px-4 py-3 text-lg text-fg-muted">
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
        </Card>

        {/* Connected Google Calendar (core/gcal.py). Hidden when Google
            sign-in isn't set up — the feed's buttons subscribe instead. */}
        {me.google_calendar && me.google_calendar !== "off" && (
          <Card
            title="Google Calendar"
            subtitle={
              me.google_calendar === "connected"
                ? "Your saved events are in a “The Belonging Collective” calendar in your Google account, and stay up to date."
                : "Put your saved events in your Google Calendar. They stay up to date when you save or un-save."
            }
          >
            <div className="flex flex-wrap gap-4">
              {me.google_calendar === "connected" ? (
                <>
                  <Button
                    size="lg"
                    leadingIcon={<GoogleCalendarIcon />}
                    onClick={() => void googleCalendarButton("connected")}
                  >
                    Open Google Calendar
                  </Button>
                  <Button
                    size="lg"
                    disabled={busy === "calendar"}
                    onClick={() => void disconnectCalendar()}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  leadingIcon={<GoogleCalendarIcon />}
                  onClick={() => void googleCalendarButton("available")}
                >
                  Connect Google Calendar
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Care links, for an account that signed up as a caregiver — the
            profile no longer turns it on. Support, not proxy: the people
            listed keep their own accounts; a link only lets the caregiver
            save into their list. */}
        {me.is_caregiver && (
          <Card
            title="People I support"
            subtitle="Save programs for someone you support."
          >
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
            <div className="flex flex-wrap gap-4">
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
          </Card>
        )}

        {me.caregivers.length > 0 && (
          <Card
            title="People who support me"
            subtitle="They can see your saved events and save programs for you."
          >
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
          </Card>
        )}
      </div>

      {careForm && (
        <Modal
          size="form"
          title={careForm === "create" ? "Their account" : "Link their account"}
          subtitle={
            careForm === "create"
              ? "Their name, email and a password. It is theirs to sign in with."
              : "Enter what they use to sign in."
          }
          onClose={() => setCareForm(null)}
        >
          <div className="mt-10">
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

/**
 * One card per thing, headed the way the sheet heads its blocks: a name and
 * a grey line. `lead` sits to the left of the heading (the picture).
 */
function Card({
  as = "section",
  title,
  subtitle,
  lead,
  children,
  onSubmit,
}: {
  as?: "section" | "form";
  title: string;
  subtitle?: string;
  lead?: ReactNode;
  children?: ReactNode;
  onSubmit?: (e: FormEvent) => void;
}) {
  const Tag = as;
  return (
    <Tag
      onSubmit={onSubmit}
      aria-label={title}
      className="flex flex-col gap-6 rounded-card border border-line bg-surface p-6 sm:p-8"
    >
      <div className="flex items-center gap-5">
        {lead}
        <div className="min-w-0">
          <h2 className="truncate text-xl font-medium text-fg">{title}</h2>
          {subtitle && <p className="text-base text-fg-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Tag>
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
