"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Link2, Trash2 } from "lucide-react";
import {
  ApiError,
  api,
  apiMessage,
  createShareLink,
  sharedListUrl,
  updateMe,
  uploadAvatar,
  type Me,
} from "@/lib/api";
import { EMBLEMS } from "@/lib/emblems";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";

const CARD = "flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6";
const HEADING = "text-lg uppercase tracking-wide text-fg-muted";

/**
 * The member's own settings: email, picture, list link. Small on purpose —
 * labels, not explanations, and one card per thing.
 */
export default function ProfilePage() {
  const router = useRouter();
  const { show } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "picture" | "link" | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
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

  if (!me) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface-subtle text-fg-muted">
        <p className="text-2xl">Loading…</p>
      </main>
    );
  }

  const name = `${me.first_name} ${me.last_name}`;
  // The same short form the feed header uses, so the initials keep one colour.
  const short = `${me.first_name} ${me.last_name.charAt(0)}.`;
  const passwordAccount = me.auth_type === "password";
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
              label={passwordAccount ? "Sign-in email" : "Email (optional)"}
              type="email"
              autoComplete="email"
              required={passwordAccount}
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
      </div>
    </main>
  );
}
