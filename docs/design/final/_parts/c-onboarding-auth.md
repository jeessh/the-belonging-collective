# Part C — Onboarding / auth (Figma "Final" page, section "Onboarding" 399:12189)

Source: Figma `0wXuDItlg03uwYoVqRvDZQ`, page "Final", section "Onboarding". 13 frames.
Screenshots live next to this file under `06-auth-member/`, `07-auth-npo/` and
`01-feed-card-view/` (filename = `<slug>__<node-id>.png`).

Section canvas labels worth knowing: the heading "Onboarding"; the note
**"Non-profits only accessible via special link"** sits above the bottom row
(403:15951, 404:16111, 404:16160), so that row is the organizer side. Prototype
arrows: "Button w --> Sign up/Login Page", "Button --> SignUp -> Guest Account",
"Button --> Sign up Page-> Login".

Two chrome generations are mixed in this section. The `399:*`/`403:*`/`404:29*`/
`425:*` frames use the older layout (saved-events panel left with "Drag event
here" slots, view toggle top-left, "Not Logged In" top-right). The `546:*` and
`404:28*`/`404:295*` frames use the newer layout (login status + "Accessibility
Tools" in a top bar, "Event 1 of 24", Card/List toggle top-right). The modal and
toast content is what matters here; the chrome belongs to parts A/B.

## Frame table

| Node | Frame name | Folder / file | Screen / route | Situation depicted | State type (evidence) | Whose account | Built today? | New backend? | Conflicts |
|---|---|---|---|---|---|---|---|---|---|
| 546:13478 | Main Page -> Card View | `01-feed-card-view/main-page-card-view__546-13478.png` | `/` feed, signed out | Feed, "Not Logged In" chrome, card 1 of 24 with "Save event" — the state from which the sign-in modal opens (arrow "Button w --> Sign up/Login Page") | Static (no overlay, no toast) | Guest (nobody) | **Built** — `frontend/components/EventsView.tsx:347` `toSignIn` opens the overlay when a signed-out visitor saves; chrome `frontend/components/member/MemberChrome.tsx:234` | None | None on the auth side (card/chrome details are parts A/B) |
| 399:12190 | Sign up/Login Page | `06-auth-member/signup-login-page__399-12190.png` | `/` feed + modal | Modal over blurred feed: "You're not logged in!" / "Create an account to save events to your page and calendar" — buttons **Create an account**, **Login**, "Or", **Continue as guest**, close X | Overlay-modal (node has `Overlay` rect 399:12386 + `Modal Card` instance 399:12805 above the feed) | Member (chooser) | **Partial** — `frontend/components/member/LoginOverlay.tsx:14-41` is the in-feed overlay but goes straight to the name step; no three-way chooser, no "Continue as guest" button (closing/Escape is the equivalent, `LoginOverlay.tsx:55-60`) | None | Copy says the account is for "your page and calendar" — calendar is R-8 (missing). "Continue as guest" needs a definition (see Guest below) |
| 399:14571 | Sign up/Login Page -> Create an account -> Name | `06-auth-member/create-account-name__399-14571.png` | `/` feed + modal, step 1 | "Create your member account" / "You will be able to save events that you like and would like to attend later"; First name, Last name; **Login** / **Next** | Overlay-modal, static step | Member | **Built** — same two typed fields in `LoginOverlay.tsx:146-170` (`nameReady`, line 52) and `frontend/app/signup/page.tsx:144-190` | None | Register **A-4** (creation without typing) is still open; the design keeps the typed-name gate, which is consistent with "minimum registration is first + last name" |
| 403:14911 | Sign up/Login Page -> Create an account -> Email | `06-auth-member/create-account-email__403-14911.png` | `/` feed + modal, step 2 | "Provide your email" / "Now we can send all your saved events to your email!"; **Email\*** (required); **Login** / **Next** | Overlay-modal, static step | Member | **Missing** — `User` has no email (`backend/app/models/user.py:24-59`); `UserAuth`/`UserSignup` have no email field (`backend/app/schemas/auth.py:4-33`) | `users.email` (nullable, **not** unique — names aren't unique either), migration `0017`, accept on `POST /auth/user` + `PATCH /users/me`; the "send saved events to your email" promise needs a mailer job (part D / R-7) | **Conflicts with the 2026-08-13 decision** (R-7: "contact details are optional and added after signup, never required") — the design marks Email as required, and the step blocks Next |
| 403:15246 | Sign up/Login Page -> Create an account -> Password | `06-auth-member/create-account-password__403-15246.png` | `/` feed + modal, step 3 | "Set up your password" / "Please include a minimum of 5 characters"; Password\*, Confirm password\*; **Login** / **Create account** | Overlay-modal, static step | Member | **Missing in UI; a dormant backend path exists** — `POST /auth/signup/user` already accepts `custom_password` (min 8) and sets `auth_type="password"` (`backend/app/api/routes/auth.py:118-165`, `schemas/auth.py:11`); `POST /auth/login/user` verifies username+password (`auth.py:168-192`). Nothing in the frontend calls either. | If icons are kept: none. If passwords replace icons: `users.icons` becomes nullable, `uq_users_username_icons` has to be rethought, icon allocation/rate-limit code in `auth.py:82-116` retires, `POST /users/{id}/reset-key` recovery no longer applies (member would need email reset → mail + token table like `host_password_resets`, migration `0014`). Also: design says min **5** chars; backend enforces min **8**. | **Direct conflict with A-1 / CLAUDE.md "the 2-icon key IS the password"**. No icon picker anywhere in the section. Password also reintroduces the memory barrier A-1 was designed around and removes the superadmin-mediated recovery in A-3. |
| 425:10922 | Main Page | `06-auth-member/account-creation-complete__425-10922.png` | `/` feed + modal | Green check, "Account creation complete!" / "You're now free to browse and save events"; **Go back** / **Continue to events**. Header still reads "Not Logged In" (design inconsistency — the account was just created). Frame is 1512 wide, not 1440. | Overlay-modal (success dialog); the layer tree has no toast, so it's a static confirmation step | Member | **Partial** — the `/signup` wizard has a "You're in, {first}!" transition (`signup/page.tsx:507-548`); the in-feed overlay just closes and calls `handleSignedIn` (`EventsView.tsx:352`), no confirmation dialog | None | "Go back" is ambiguous after an account already exists (back to what — edit the password?). Also the design has no "here are your icons, remember them" screen because there are no icons. |
| 546:13680 | Main Page -> Card View | `01-feed-card-view/main-page-card-view-saved-panel__546-13680.png` | `/` feed, signed out, saved panel open | "Saved Events / 0 Saved Events" panel with "Saved Events go Here" and **All Saved Events** / **Google Calendar** buttons, still "Not Logged In" | Static | Guest | **Partial** — feed built; the panel is part B's territory. Showing the saved panel to a signed-out visitor contradicts today's rule that the saved list needs an account (R-3: "topics and the saved list need an account") | None for auth; Google Calendar is R-8 (missing) | Guests seeing an empty saved panel is fine only if "guest" means anonymous; if guest = lightweight account (see below), this frame is the post-guest state |
| 404:29057 | Sign up Page-> Login | `06-auth-member/login__404-29057.png` | `/` feed + modal | "Login to your account" / "Please login with your email and password."; Email, Password; **Cancel** / **Login** | Overlay-modal, static | Member | **Missing** — member login is name + icons (`LoginOverlay.tsx:174`, `POST /auth/user` `auth.py:195-293`). `POST /auth/login/user` exists but keys on **username**, not email | `users.email` as a lookup key → must then be unique (or resolve name+email), rate-limit key on email, `HostLogin`-style schema for members | Same icon-vs-password conflict. No "forgot password" link in the design at all — with an email+password member account that's a hard dead end (the icon flow at least has "I forgot my icons" → superadmin re-issue). |
| 404:29510 | Login -> Account Confirmation | `06-auth-member/login-account-confirmation-toast__404-29510.png` | `/` feed, signed in | Green toast "Successfully logged in!" with X, top-centre; header now "Sophie L."; list-view toggle active | **Transient / mid-animation** — a `Toast` frame (425:12947) sits over the header; nothing else changed vs. the base frame | Member | **Partial** — sign-in re-renders the chrome with the name (`MemberChrome.tsx:234-283`) and an `aria-live` status exists (`EventsView.tsx:926`), but there is no visible toast component; the only sweep is "Saved!" (`EventsView.tsx:1566-1583`) | None | None. Note the design shows the member's name as "Sophie L." (first name + initial) — today the chrome shows `first_name` only (`lib/api.ts:120`) |
| 404:28235 | SignUp -> Guest Account | `06-auth-member/guest-account-toast__404-28235.png` | `/` feed | Blue toast "You're currently viewing as a guest" / "If you'd like to save or sign up for events, please login or sign-up" with X. **Header nevertheless shows "Sophie L."** with the member avatar. | **Transient / mid-animation** — `Toast` frame 425:12916 over the header; arrow "Button --> SignUp -> Guest Account" says it follows "Continue as guest" | Guest — but see the header | **Partial** — signed-out browsing is built (R-3, `EventsView.tsx:121-123`, `202`); there is no guest toast, and there is no guest *account* | Depends on what guest means: (a) anonymous → none; (b) a named session without credentials → a `users` row with `auth_type="guest"`, no icons, cookie-only, plus a "claim this account" upgrade path and rate-limit on creation (P-3a) | The frame contradicts itself: guest toast + a named, avatar'd "Sophie L." header. Either the designer reused the signed-in header by mistake or "guest" = a name-only account. Decision needed. |
| 403:15951 | Create account | `07-auth-npo/create-account__403-15951.png` | Standalone page (special link) | KW Habilitation logo; "Create an account for your non-profit"; First name, Last name, **Email\***, divider, **Set password\***, **Confirm password\***; **Create account** | Static, full page (no feed chrome) | NPO / organizer | **Partial** — the invite acceptance page `frontend/app/host/invite/[token]/page.tsx` is this screen: token-scoped link, shows org + email, asks for password + confirm, `POST /invites/accept` (`backend/app/api/routes/invites.py:148-200`). Differences: the design asks for First/Last name (today the account is the **organization**, per §3.5 one login per org) and lets the user type the email (today the email is fixed by the invitation and shown read-only). | If names are wanted: `hosts.contact_first_name/last_name` (nullable) + migration; or treat them as display-only and drop them. Editable email contradicts the invite binding — keep read-only. | Per-person names on a per-organization login (§3.5). KW Hab logo on the organizer door: today the console is "The Belonging Collective" branded — a client branding call, not a code one. |
| 404:16111 | Email verification | `07-auth-npo/email-verification__404-16111.png` | Standalone page | Logo; "We've sent a code to your email" / "Click the link to verify your account!"; **Enter 6-digit code**; **Verify account** | Static, full page. The copy is self-contradictory (code *and* link). | NPO / organizer | **Missing as drawn; functionally redundant** — the invite token *is* the email verification: the link is mailed to the invited address (`invites.py:44-80`), single-use, 14-day expiry (`INVITE_DAYS`). Nobody who didn't receive the mail can reach the create-account page. | If a code step is genuinely wanted: `host_email_verifications` table (hash, expiry, attempts), `POST /auth/host/verify`, mailer via `backend/app/core/mail.py:26` (exists), rate limit on attempts. Otherwise none. | Adds a second mail round-trip on top of the invitation for no security gain. Recommend treating it as satisfied by the invite link. |
| 404:16160 | Login | `07-auth-npo/login__404-16160.png` | `/host` | Logo; "Login to KWhab Events"; Email, Password; **Login**. Hidden text layer 404:16166 "Click the link to verify your account!" (leftover from the previous frame). | Static, full page | NPO / organizer | **Built** — `frontend/app/host/page.tsx` (email+password → `POST /auth/login/host`, `auth.py:296-341`). Design omits the "Forgot your password?" link that `host/page.tsx:88-96` has and A-5 depends on. | None | Design has no forgot-password and no "ask a superadmin" copy; keep both (A-5, A-7). Branding "KWhab Events" vs. "The Belonging Collective / Admin console". |

## Flows reconstructed

### Members (as designed)
1. Browse the feed signed out (546:13478). Press **Save event**.
2. Modal "You're not logged in!" (399:12190): **Create an account** / **Login** / **Continue as guest**.
3. Create an account → **Name** (399:14571: first + last, typed) → **Email** (403:14911, required) → **Password** (403:15246, password + confirm, min 5) → **Account creation complete!** (425:10922) → **Continue to events**.
4. Login → email + password (404:29057) → toast "Successfully logged in!" (404:29510), header shows "Sophie L.".
5. Continue as guest → toast "You're currently viewing as a guest…" (404:28235); saving stays gated behind the modal.

### Members (as built)
1. Browse signed out. Press save → `LoginOverlay` over the same card (`EventsView.tsx:347`).
2. Name (first + last) → pick two icons in order → `POST /auth/user` decides login / signup / conflict (`auth.py:195-293`).
3. Overlay closes; `handleSignedIn` completes the pending save (R-3 "preserve the intent").
4. No email, no password, no confirmation dialog, no toast. Recovery = superadmin `reset-key` + "I forgot my icons" (`signup/page.tsx:429-500`).

The two flows share exactly one screen (Name). Everything after it diverges.

### Caregivers
Not present in this section. No frame, layer or copy mentions a caregiver, a
linked account or acting on someone's behalf (register **A-8** still ❌). If the
client expects caregivers to onboard members, the design gives no surface for it.

### NPOs / organizers (as designed)
1. Reach a **special link** (canvas note) → "Create an account for your non-profit" (403:15951): first/last name, email, password, confirm.
2. "We've sent a code to your email" (404:16111): enter a 6-digit code → **Verify account**.
3. "Login to KWhab Events" (404:16160): email + password.

### NPOs (as built)
1. Superadmin issues an invite in the console (`POST /invites`); the link goes to the invited email.
2. `/host/invite/{token}` shows "Welcome, {organization} — you'll sign in with {email}", asks for password + confirm, `POST /invites/accept` creates the `Host` and signs them in.
3. `/host` email + password thereafter; `/host/forgot` → `/host/reset` for recovery.

The NPO row lines up with the invite flow almost 1:1: **the "special link" is the
invite token**, step 1 is the accept page, step 3 is `/host`. Step 2 is the only
piece with no counterpart, and the invitation already proves control of the
mailbox. What differs is form fields (per-person name, editable email) and
branding.

## Guest account — what it means here

Evidence points both ways:
- The modal offers "Continue as guest" *instead of* creating an account, and the toast says saving/sign-up needs "login or sign-up" — i.e. guest = **anonymous browsing**, matching the FigJam flow and today's R-3 build.
- But the guest frame (404:28235) shows a signed-in header ("Sophie L." with the coloured avatar) and the saved-events panel, and the decision log says minimum registration is first + last name. That reads as guest = **name-only lightweight account**.

Recommendation to put to Jesse: treat guest as anonymous (already built, zero
backend) unless the client confirms they want a named guest — in which case it
is a new `auth_type="guest"` user with no credential and an upgrade path, and
P-3a (uncapped account creation) becomes urgent because such accounts are
free to mint.

## New backend work implied

Ordered by how much the design depends on it. None of this should start before
the conflicts below are decided.

1. **Member email** — `users.email` nullable text (not unique), migration `0017`, added to `UserAuth`/`UserSignup`/`PATCH /users/me` and to `Me` in `frontend/lib/api.ts`. Required-ness is the conflict, the column is cheap. The "send your saved events to your email" promise is a mailer + scheduler (R-7 territory, part D).
2. **Member password login** — only if icons are replaced or supplemented:
   - `users.icons` nullable; revisit `uq_users_username_icons`; `auth_type` gains real meaning (`"password"` is already a value, `auth.py:126-131`).
   - Email-keyed login: `POST /auth/login/user` currently keys on `username` (`auth.py:168-192`) — new or amended endpoint, rate-limit identity key on email, uniqueness policy for email.
   - Member password reset by email: table like `host_password_resets` (`backend/alembic/versions/0014_host_password_resets.py`), two endpoints mirroring `/auth/host/forgot|reset` (`auth.py:350-512`), mail via `core/mail.py`. Not drawn, but unavoidable once members have passwords.
   - Password policy: design says min 5, backend says min 8 (`schemas/auth.py:11`, `invites.py:41`).
3. **Guest account** (only if "named guest" is chosen) — `auth_type="guest"`, credential-less session, claim/upgrade endpoint, creation cap (P-3a).
4. **NPO create-account fields** — if per-person names are kept: two nullable columns on `hosts` + migration; editable email should stay bound to the invite (`invites.py:171-176` sets `email=invite.email`).
5. **NPO email verification code** — new token table + `POST /auth/host/verify` + attempt limiting. Recommended **not** to build; the invite link already verifies the mailbox.
6. **Toasts** ("Successfully logged in!", guest notice) — frontend only; reuse the `aria-live` region at `EventsView.tsx:926` so they are announced, not just drawn.
7. **Name display "Sophie L."** — frontend only (`Me.first_name`/`last_name` both exist).

Already in place and reusable: `core/mail.py` (SMTP, logs when unset), invite
token pattern (`invites.py:26-31`), reset token pattern (`auth.py:344-512`),
Postgres rate limiting (`core/rate_limit.py`).

## Conflicts / decisions Jesse must make

1. **Icon key vs. email + password for members** (403:15246, 404:29057). The design has no icon picker anywhere; CLAUDE.md, A-1 and A-3 are built around the icon key and the superadmin-mediated recovery it enables. Options: (a) keep icons and treat the design's password screens as superseded; (b) passwords replace icons (large backend change, reintroduces the memory barrier, needs member email reset); (c) both — icons default, optional password later (the dormant `custom_password` path in `auth.py:118-165` is the seed of this). The design also gives members **no** forgot-password route, which under (b) is a dead end worse than today's.
2. **Required member email** (403:14911) vs. the 2026-08-13 decision that contact details are optional and added after signup (R-7). Making the step optional/skippable keeps the decision; making it required overturns it.
3. **What "Continue as guest" is** — anonymous (built) or a name-only account (new). The guest frame's signed-in header has to be explained either way.
4. **NPO special link = invitation?** If yes (recommended), 403:15951 is `/host/invite/[token]` with cosmetic changes and §3.2 / "no host signup route" hold. If the client means an open link anyone at an agency can use, that is a self-serve signup with a shared URL and contradicts §3.2 and A-7.
5. **Per-person names on an organizer account** (403:15951) vs. §3.5 one shared login per organization. Store as contact fields, drop, or reopen §3.5.
6. **Email verification code for NPOs** (404:16111) — redundant with the invite link; build only if the client insists.
7. **Password minimum** — 5 (design) vs 8 (backend, both members-if-ever and hosts).
8. **Branding** — the organizer pages carry the KW Habilitation logo and "KWhab Events"; the member modal copy promises "your page and calendar" (Google Calendar = R-8, not built). Confirm which name the product ships under and whether calendar is in scope before the copy goes in.
9. **Saved panel visible to guests** (546:13680) — today the saved list needs an account (R-3). Fine as an empty-state teaser; a real change if guests can save.
10. **Caregivers** — absent from the design entirely; A-8 stays open and nobody has drawn it.
