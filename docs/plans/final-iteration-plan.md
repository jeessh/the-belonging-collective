# Final iteration plan — FigJam flows + Figma "Final" page vs. the build

Assessed 2026-09-27 against `master` at `0449d0f`. Two sources:

- **FigJam "KW Habilitation User Flows"** (`XI1XuKznmPt5aePD5Fspen`): Version 1,
  Section 2, Section 3, Section 4, loose decision-log text, the Impact Effort
  Matrix. §§2–3 below.
- **Figma design file, page "Final"** (`0wXuDItlg03uwYoVqRvDZQ`, node
  393:5866): 68 frames, catalogued in `docs/design/final/README.md` with the
  four part files under `docs/design/final/_parts/`. §7 below.

Register IDs are the ones in `docs/product-context.md` §4; new IDs minted here
follow the same style and have been added to that register. File:line
references are to the tree at the commit above. The board and the design set
the requirement; the code decides the status.

---

## 1. TL;DR

- **Matrix:** of the ten stickies above the 60% impact line, none is done
  outright, seven are partial, three are missing; Feedback (57%, flagged) is
  missing. The design file confirms the same gaps in pixels and adds a layer of
  its own: a persistent saved sidebar with drag-**left**, a list view, tag
  pills, attendee counts, Important Links, share-by-email with HTML mail, print
  previews, a console details page, emailed invites.
- **Quick wins first (Phase 0, no decisions needed):** add-to-calendar (`.ics`
  + Google template link — 75% impact, 6% effort, and the design's Google
  Calendar button has no defined behaviour anyway), start times and tag pills
  on every card (the carousel card and detail modal show no time today),
  console counts, poster/list print with QR, member share, "Un-publish"
  wording, end time and description cap on the form, the label/toast
  alignment the design asks for, removing the TEMPORARY staff link, and
  removing the sign-in icon from the saved panel.
- **Google Calendar question:** nothing is needed from the user. Ship `.ics`
  plus a template link, offered right after a save. Two-way sync needs a
  verified Google OAuth app, refresh-token storage and a member email — members
  have no email by design. Don't build it.
- **Twelve decisions block the rest (§5), ordered by how much they hold up.**
  The two biggest: the member credential (the design draws email + password
  with no icon picker; the record says the icon key *is* the password), and the
  saved sidebar + drag-left layout (touches all six save paths and every
  mobile layout).
- **Mobile is the largest single gap** (71/95): the carousel and the console
  pages have zero breakpoints. It is scheduled after the layout decision so the
  chrome is laid out once.
- **Docs fix:** CLAUDE.md's "persistent sidebar, table-first" description of
  the console is stale for `/host/events` — it has been `AdminShell … bare`
  with `ConsoleHeader` + `PostedEventCard` since PR #20 (`app/host/events/page.tsx:24`).
  The sidebar and tables remain only on the other `/host` pages. Update the
  doc; do not "restore" the sidebar — the v2 design and the code agree.
- **Not planned:** transportation, emailed recommendation digests (no member
  email), community-added events, audience detection, an in-platform
  organizer calendar (Jesse's own note), NPO email-verification code
  (redundant with the invite link), true calendar sync, a map view (until D-4).

---

## 2. Impact Effort Matrix — status per item

Quadrant: HI/LE = high impact, low effort (do first); HI/HE = high impact,
high effort (plan); LI/LE = low impact, low effort (maybe); LI/HE = drop.

| # | Sticky | Impact | Effort | Quadrant | Status | Evidence | What "done" means |
|---|---|---|---|---|---|---|---|
| 1 | **Onboarding (preferences)** — switch views based on user inputs; grid / carousel / map | 96% | 76% | HI/HE | 🟡 Partial | Carousel and grid both exist and switch live (`components/member/MemberChrome.tsx:11` `ViewToggle`; `components/EventsView.tsx:138` `viewMode`). The choice is session state only — nothing persists it, and signup asks about interests only (`app/signup/page.tsx:200-267`). No map view: `location` is one free-text string (`backend/app/models/event.py:58`), no coordinates (D-4 ❌). The design's second mode is a **list** of rows, not a grid (README 02, D-14). | Signup (and the settings menu) asks "How do you want to see programs?" as two pictogram tiles; answer persisted on `users.preferred_view`; feed opens in it. Accessibility-mode users default to the carousel, since voice/head/keyboard actions are carousel-only (`EventsView.tsx:723`). Map view stays deferred behind D-4. **O-1**, with the list view **D-14**. |
| 2 | **UX Changes** — filters more visible; save easier to find; bigger date & time; important actions clearer | 92% | 26% | HI/LE | 🟡 Partial | *Filters:* the carousel has none — a comment says so (`EventsView.tsx:1026-1028` "No filter bar: the design doesn't have one" — the Final design **does** have a chip row, README 01); cost/organization are *grouping* dimensions (`lib/dimensions.ts:60-85`), and the grid has a text search (`components/member/GridFeed.tsx:293`). `GET /events` already accepts `free`, `category`, `tag`, `q` (`backend/app/api/routes/events.py:111-131`); the feed never sends them. Register rows D-2/D-3 were stale and are corrected. *Save:* the bottom save bar is large and labelled (`components/member/FeedParts.tsx:403-423`), grid cards carry a 44px bookmark (`GridFeed.tsx:92-109`), the detail modal has "Save Event" (`components/member/EventDetailModal.tsx:143-153`); the design puts a "Save event" button on the card itself. *Date & time:* the carousel card shows the **date only**, no start time, at `text-lg` under a 34px title (`FeedParts.tsx:242,253-273`); the detail modal also shows **no time** (`EventDetailModal.tsx:97-107`); the grid card shows date+time but at `text-sm text-muted` (`GridFeed.tsx:55-72`). Only the public event page shows weekday, date and time (`app/events/[id]/page.tsx:130-142`). The design shows relative date + date + time range + tag pills on every card. | Start time on every member surface, date+time set at display weight (≥ the description, second only to the title), tag pills (Free/Paid · Drop-in/Sign-up · In-person/Virtual). A visible filter row (Free / Paid / this week / organization) on both views, chips not a dropdown, honouring the standing rule that only the member's *explicit* filters hide anything. Remove the "Staff sign-in" link the feed still carries (`EventsView.tsx:954-967`, marked TEMPORARY). **D-10, D-11, D-12.** |
| 3 | **Onboarding (Navigation)** — teach users how to use the platform | 90% | 85% | HI/HE | ❌ Missing | No first-run state anywhere (grep: no `localStorage`, no tour/tutorial). The only teaching is the save bar's "Use ↓ or drag event down" and the switch hints in the settings dialog (`EventsView.tsx:1481-1503`). The design file draws no tour either. | A three-step first-run overlay — pictogram + one word each (Next → / Save ↓ / List ↑), read aloud when TTS is on, skippable, replayable from the settings menu. Persisted on `users.onboarded_at`; `localStorage` for signed-out visitors. Copy stays labels, not explanations (§3.3). **O-2.** |
| 4 | **Access Control (@Jesse)** — restricted event sets; unlisted org links; requests routed to that org's admins; member↔admin platforms connected; admin levels | 85% | 41% | HI/LE | 🟡 Partial | *Admin levels:* done — two tiers on `hosts.is_admin` (`backend/app/api/routes/hosts.py:55-56`, `backend/app/api/deps.py:109-113`), promote/demote in the console (`app/host/admins/page.tsx:213-215`), self-demotion guarded (`hosts.py:158-181`). The design's superadmin table has **no** Access column — keep the code's (§5 confirmations). *Everything else:* missing — `Event` has no visibility field (`models/event.py`), every live event is public (`events.py:121-123`), no member↔organization relation exists, no request flow. The console does manage members (`/host/users`, superadmin-only), which is the "connected platforms" half. The NPO "special link" in the design **is** the invite token (README 07). | Two increments. **A-9 unlisted:** `events.visibility ∈ {public, unlisted}`; unlisted programs leave the feed and sitemap but open by link. **A-10 restricted + requests:** `visibility = restricted`, a `memberships(user_id, host_id, status)` table, "Ask to join" on a restricted card, requests listed in the console for that organization's login only. A-10 needs a decision on scope (§5.12). |
| 5 | **Stakeholder / ecosystem** — Simon organises & spreads awareness; word-of-mouth, parent support, physical boards are the channels to complement | 78% | 22% | HI/LE | 🟡 Partial | Mostly non-software. What the platform already gives: a public, server-rendered page per program with OG cards (`app/events/[id]/page.tsx`, M-5 ✅ / M-6 🟡), Copy link on every console row and on publish (`app/host/events/page.tsx:164-175`), and a per-program print that strips the console chrome (`components/host/PostedEvents.tsx:373-385`, `app/globals.css:44-59`). Missing: a printable *list*/poster with a QR code for the physical boards, and any share affordance on the member side (the detail modal has none, `EventDetailModal.tsx:133-153`). The design draws member-side Print (list and single event, README 05) and Share by email / by link. | **M-8:** print in the console (poster per program or a one-sheet list, each with a QR) and on the member side (saved list, single event) via `window.print()` and the existing print CSS. **M-9:** Share on the member detail modal and event page (Web Share API, copy-link fallback). **M-10** share by email and **M-11** shareable list link are the design's additions, gated on P-6 and §5.7. Simon-as-organiser is the below-line "community-added events" sticky; not planned. |
| 6 | **Profile pictures & accounts** | 76% | 76% | HI/HE | 🟡 Partial | Organizations: done — `hosts.logo_url` (`backend/app/models/host.py:37`), self-service upload (`hosts.py:718-738`, `components/host/ConsoleHeader.tsx:155-214`), shown on the stepper rings. Members: accounts exist (name + two-icon key, `backend/app/core/icons.py:22`), no picture. The sign-in overlay tells members the icons "aren't a profile picture" (`components/member/LoginOverlay.tsx:182`) — and yet the saved panel heading renders `emojiFor(me.icons[0])`, the first icon of the two-icon credential (`components/SavedEvents.tsx:147`), on a screen a caregiver or anyone nearby can see. Image upload is host-only (`events.py:47`). The design shows a coloured avatar circle and "Sophie L." in the header, nothing more. | Needs a decision (§5.10). If yes: `users.avatar_url`, a member-scoped upload route (or a fixed set of non-credential emblems chosen at signup), shown on the account chip and saved panel. Either way: **stop rendering the icon on the saved panel (A-11a, Phase 0).** **A-11.** |
| 7 | **Save to calendar** — auto-add the event immediately after registration | 75% | 6% | HI/LE | ❌ Missing | Nothing (R-8 ❌; grep for `ics`, `text/calendar`, `calendar.google` finds no hit). The design puts a "Google Calendar" button on the sidebar and the saved page with **no prototype arrow** — behaviour undefined — and the share mail promises "a link to add the event to their calendar". | `GET /events/{id}/calendar.ics` plus an "Add to Google Calendar" template link, offered on the "Saved!" moment (`RegisterPrompt`, detail modal, saved-panel card, event page), attached to the share mail (M-10). "Auto-add" without account linking is impossible; auto-*offer* right after saving is the equivalent. See §4. **R-8.** |
| 8 | **Mobile & tablet device support** | 71% | 95% | HI/HE | 🟡 Partial | *Member carousel:* zero responsive classes (grep for `sm:|md:|lg:` in `EventsView.tsx` and `FeedParts.tsx` returns only the grid's column rule). The card is `aspect-[2.3/1] h-full max-h-[382px] w-auto max-w-[880px]` (`EventsView.tsx:1119`) — height-led, so on a phone its width exceeds the viewport; inside it, `p-10 gap-10`, a square `h-full` image and a 34px title (`FeedParts.tsx:223-243`). Side zones are `width: min(288px, calc(50% - 300px))`, which is negative under 600px and clamps to 96px over the card (`EventsView.tsx:1609-1614`). The page is `h-dvh overflow-hidden` (`EventsView.tsx:882`), so nothing scrolls on a short screen. Sign-in overlay: a six-column icon grid inside `p-10` (`LoginOverlay.tsx:237`). *Grid view and signup* adapt (`GridFeed.tsx:273`, `signup/page.tsx:220,315`). *Console:* `AdminShell` collapses its sidebar (`components/AdminShell.tsx:183-184`) but the pages inside have no breakpoints: `px-8` and a `min-w-[380px]` list beside a `max-w-[430px]` filter panel (`app/host/events/page.tsx:179,209`; `PostedEvents.tsx:162`), fixed 150px card images (`PostedEvents.tsx:271`). Framer drag works with touch; no `touch-action` set. Every design frame is 1440 wide; nothing narrower is drawn. | Phone (≥360px) and tablet (768–1024, both orientations) layouts for: carousel (card stacks image-over-text under `sm`, arrows move below the card, save bar compacts to one control), sign-in overlay, saved panel, detail modal, console list/filters/forms. `touch-action: pan-y` off the card so a vertical drag never fights the browser. **P-5.** Waits on §5.2 so the sidebar question is settled before the layout is cut twice. |
| 9 | **Recommended events** — a simple curated set at the top of the week as a filter; users can dismiss | 70% | 61% | HI/HE | 🟡 Partial | Personalised *ordering* exists — topic +3, access need +5, ties keep server order (`lib/feed.ts:18-19,84-89`) — and nothing is hidden by it. There is no named "recommended" set, no weekly framing, and no dismiss (grep: none). Not drawn in the design file. | A "For you this week" group: top-N by `matchScore` among programs starting in the next 7 days, shown as the first stepper bucket / first list section, only when the member has interests or needs set. Dismiss removes one program from *that group only* (never from the feed) and persists on `users.dismissed_program_ids` (series id). **D-13.** |
| 10 | **Centralized event registration** — count signups; signups on this platform rather than external; tells the user who is going | 69% | 37% | HI/LE | 🟡 Partial | *Counting:* `EventOut.saved_count` is computed per row (`models/event.py:171-177`) but the console only shows it as "N left"/"Full" when a capacity is set (`PostedEvents.tsx:313-320`); no absolute count, no click-through count on screen (M-2 records them). The design shows "20 Attendees" on every console card and every member card. *On-platform signup:* internal registration is the attendance row (`backend/app/api/routes/attendance.py:49-136`); external stays first-class per §3.1. *Who is going:* missing — attendance is private (D-7 ❌), and even the count never reaches a member. | Console shows saved and registration-click counts on every row (**M-1**, un-descoped). Members see "N going" on the detail modal and event page — count only, no names (**D-7a**). Whether that count reflects *saves* or *registrations*, and what it is called, depends on §5.3/§5.5. |
| ⚑ | **Feedback** (57% — flagged) — members say what events they want; in-platform input; likes/dislikes/voting questioned for CTA overload. Jesse: "what is their current flow for obtaining feedback?" | 57% | 69% | borderline | ❌ Missing | Nothing in the codebase (grep for `feedback` hits only a webgazer id). The AI interview tab was descoped 2026-08-05 because it needed an external API; still wanted. Not drawn in the design file. | A no-API version first: on the saved panel and detail modal (not the card — one primary action per card holds), "Want more like this?" 👍/👎 plus an optional short note, voice-dictated where speech is on. Stored in a `feedback` table, listed in the console per organization. The conversational interview stays a later layer on the same table. Jesse's question stays open for the client. **F-1.** |

Below-the-line stickies (not planned): Transportation assistance (41/95),
Emailed recommendations (37/41 — blocked on members having no email, R-7),
Community-added events (23/27), Personalized audience-aware experience
(23/95), Admin/organizer support incl. in-platform calendar (5/91 — Jesse's
note: "not internal calendar").

---

## 3. Flow-by-flow comparison (FigJam)

### 3.1 Version 1 — Authentication + Event Management (member)

| Board | Build | Verdict |
|---|---|---|
| Carousel → browse by any method → find event → decide to go | Feed is the home page, open signed-out (`app/page.tsx:17-20`); six input paths to save (X-1 ✅). | Matches. |
| "Is registration mandatory?" → No → Save | `requires_signup = false` → Save (`components/EventActions.tsx:8-13`; carousel/modal branch the same way). | Matches. |
| Yes → has account? → log in / sign up → register → carousel (saved) | Save attempted signed-out opens the sign-in overlay over the feed with the program preserved (`EventsView.tsx:347-381`), then `RegisterPrompt` offers registration for that program (`components/member/RegisterPrompt.tsx`). | Matches, and improves on it (no navigation away). |
| Decision log: login mandatory iff registration required | Login is required for *saving* in every state (R-3), not only when registration is required. Following an external link never needs an account. | **Divergence, deliberate** (§3.7 of product-context): saving is the gate. |
| Decision log: track registration-link clicks/saves | `event_registration_clicks` (M-2 ✅); saves are rows in `event_attendees`. | Matches. |

### 3.2 Section 3 — the newer member flow (independent community members)

| Board | Build | Verdict |
|---|---|---|
| "User drags event into the **left side panel**" | Drag **down** into a bottom save bar (`EventsView.tsx:68` `DROP_THRESHOLD`; `FeedParts.tsx:400` `SaveZone` at `bottom-10`). The saved list is a full-screen panel opened by drag-up / ↑ / button (`EventsView.tsx:69`, `components/SavedEvents.tsx`). No side panel. | **Divergence.** The Figma "Final" page draws the same left sidebar and drag-left in detail (README 01) — so this is now the design's settled intent, not a sketch. §5.2. |
| Has account? → logged in? → yes → "information automatically sent to admin for event" | Saving writes the attendance row; the console sees a *count*, never names (`PostedEvents.tsx:313-320`). | **Partial.** No attendee list for hosts. Depends on §5.3 (saved vs. registered) and privacy. |
| Logged in? → No → "Sign-up as guest?" → Yes → "input necessary information" → saved | No guest path. Saving requires an account: first + last name + two icons (`LoginOverlay.tsx:154-168,237`). | **Divergence.** See §5.6. A guest attendance row would still need a `users` row (FK, `models/attendance.py:22-30`), which becomes an account nobody can get back into. |
| Saved → "Is Google Calendar connected?" → auto-add / ask / skip → event in side panel | Nothing (R-8 ❌). | **Missing.** §4 answers the @Jesse question. |
| "Do we really want users to automatically sign-up for events?" (open note) | For `internal + requires_signup`, save **is** the registration — same row (`EventActions.tsx:12`). For external, save is a bookmark and the link is separate. | **Open.** §5.3. |

### 3.3 Section 4 — Onboarding User Flow (User: All)

| Board | Build | Verdict |
|---|---|---|
| Enter → browse events → tries to save → has account? | Same (`EventsView.tsx:405-411` `attend` → `toSignIn`). | Matches. |
| Clicks "create an account" → account? → wants account? → No → "Continue as guest" → "can browse without being able to save" | Feed is public; saved panel and topics need an account; accessibility modes work signed-out (`EventsView.tsx:120-123`). | Matches. |
| Account creation: "Is user a care giver or community member?" | No user types. One member account shape (`backend/app/models/user.py`). A-8 ❌. The design file has no caregiver anywhere either. | **Missing** — and a conflict, §5.1. |
| Caregiver: first name, last name, **email, password** → optional community-member account → email notifications → Google Calendar → **grid view** | Members have no email or password column (`models/user.py:24-33`); auth is the icon key (A-1). No notifications (R-7 ❌). No calendar (R-8 ❌). Grid exists but is not routed by user type. The Figma page goes further: **every** member gets name → required email → password, and no icon picker exists (README 06). | **Conflict** with the "contact details optional, never required" decision (R-7) and with icon sign-in. §5.1. |
| Community member: first + last name → "chooses icon as personal identifier" → **list view** | Name (typed — A-4 ❌ still) + two icons (`signup/page.tsx:159-173,315`). "Personal identifier" undersells it: the icons are the password. The list view is what the design draws (D-14); the carousel is the default. | Matches in substance. Copy on the board should say the icons are the key. |
| Sticky: "What if the saved events the community member saves is synced with the caregivers?" | No relation between users. | A-8. |

### 3.4 Section 2 — Admin Event Management

| Board | Build | Verdict |
|---|---|---|
| Login → "Are they a super admin?" → modified list with deletion vs. normal list | One list, buttons gated per row: `canEdit = isSuper \|\| owner`, `canDelete = isSuper \|\| owner` (`app/host/events/page.tsx:240-241`). Superadmins also get Users and Organizations tabs (`ConsoleHeader.tsx:53-57`). | Matches the tiered list. |
| Edit pre-existing event (only their own) → save changes | API 403s on another org's program (`events.py:250-252`, N-3 ✅); console shows view-only. | Matches. |
| Deletion superadmin-only | An owner may archive their own program **while nobody has saved it**; refused after (`events.py:343-358`). Superadmins always. Archive, never delete (§3.8). The v2 design calls it **Un-publish**. | **Divergence, already resolved** in product-context §3.8 / N-5. Adopt the word, keep the rule (§5 confirmations). |
| Create → input details → added to list → copy link to share | Create form, publish toast with share link and Undo, Copy link on every row (`host/events/page.tsx:90-110,164-175`; N-6, N-7 ✅). The v2 design's cards have only View Details — no share icon anywhere. | Matches; N-7 keeps the row icon (§5 confirmations). |

### 3.5 Loose decision-log text

| Board | Build | Verdict |
|---|---|---|
| "Registration is mandatory for every event, even for the drop-ins" — to track who is going and show a social counter | Drop-ins are saved, not registered (`requires_signup=false`), **but a save already writes an attendance row for every state**, so the data the board wants exists for drop-ins too. What's missing is the counter (D-7a) and any name list. | **Conflict in wording, not in data.** §5.5. |
| "At the very minimum, registration can just be first name last name. Admins can set other requirements if necessary" | Account = first + last name + icons. Hosts cannot add per-event questions (no such field on `Event`). | Name-only ≈ done (plus the key). Per-event extra questions: not built, not planned unless an agency asks. |
| "One primary action per event card" — not save, like/dislike, register and calendar all on the card | Carousel card has one button, Expand (`FeedParts.tsx:295-308`); save is the bar/drag/key. Grid card has Open + a small bookmark (`GridFeed.tsx:27,92`). The design's card has two: "More information →" and "Save event". | Matches, near enough. Calendar, share, print and feedback therefore go on the detail modal and saved panel, not the card — which is where the design puts them. |
| "Save framed as a bookmark; in Saved, choose add-to-calendar or register" | Saved panel cards offer Open and un-save only (`SavedEvents.tsx:300-307`). No register or calendar action from Saved. The design's saved page has Google Calendar / Share list / Print list, and un-save moves into the modal. | **Partial.** R-8 and R-9 add both. |
| External registration: "register, return, confirm 'yes, I registered', then added to calendar" | Click is tracked before leaving (`EventsView.tsx:477-483`); nothing asks on return. | **Missing.** Part of R-9. |
| "Users will use platform on their own with guided assistance"; "Register / save to calendar / add to your list / **printing out list**" | Print exists per program in the console only (`PostedEvents.tsx:373-385`). Members cannot print their saved list. The design draws both member print previews. | M-8. |

---

## 4. The Google Calendar question

Board, Section 3: *"@Jesse Huang what is needed from the user to connect it to
the platform?"* The design file has "Google Calendar" buttons on the sidebar
and the saved page with no prototype arrow, so this answer also defines them.

**Short answer: nothing — if we don't "connect" anything.** Two ways to do it:

| | A. Template link + `.ics` (recommended) | B. Two-way sync (Google Calendar API) |
|---|---|---|
| What the user does | Taps "Add to calendar" after saving. Google users land on a pre-filled event page and press Save; everyone else gets an `.ics` file their phone opens in Apple/Outlook/Google. | Signs in with Google inside our app, grants calendar permission on Google's consent screen, and must have a Google account tied to their member account. |
| What we need from the user | Nothing. No account link, no email. | A Google account and an email on the member record — members have neither by design (A-1, R-7). |
| What we need from Google | Nothing. The template URL is a public, documented format (`calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…&location=…&details=…`). | A Google Cloud project, OAuth client, consent screen, the `calendar.events` scope (a *sensitive* scope → app verification with a privacy policy and Google's review before non-test users can consent), a redirect URL on our origin. |
| What we store | Nothing new. | Encrypted refresh tokens per member, token rotation, revocation handling, a sync log, and Google's event ids so a reschedule updates the right entry. |
| Keeps up with reschedules | No — the entry is a copy. A rescheduled program (N-8, not built) needs a re-add. | Yes, that is the point of B. |
| Works for Apple / Outlook / Samsung calendars | Yes (`.ics`). | No — Google only. |
| Works on shared agency devices / kiosk use | Yes. | Badly: a connected Google account on a shared device is somebody's private calendar. |
| Cost | S: one backend route, one button in four places. | L, plus ongoing: verification wait, token ops, support when a member's Google session lapses. |

**Recommendation: A.** Build `GET /events/{id}/calendar.ics` (one `VEVENT`
per occurrence, `UID = event id`, `DTSTART`/`DTEND` in UTC, `SUMMARY`,
`LOCATION`, `DESCRIPTION` with the public URL, `URL`) and render the Google
template link client-side from the same fields. For a series-priced program the
member was enrolled across, emit every enrolled date in one file; for the
saved page's list-level button, `GET /users/me/events/calendar.ics`. Offer it
on the "Saved!" moment: in `RegisterPrompt`, on the detail modal once saved, on
each saved-panel card, on the public event page, and as the attachment the
share mail (M-10) promises. The board's "Is Google Calendar connected?"
diamond collapses to "was it offered" — which is the "auto-add immediately
after registration" the matrix sticky asks for, as far as it can be done
without linking accounts.

Revisit B only if caregiver accounts with an email (A-8) ship and caregivers
ask for live sync. Even then, an `.ics` *subscription* feed per member
(`webcal://…/users/{token}/calendar.ics`, which Google/Apple poll) gets most of
the way with none of the OAuth surface.

---

## 5. Conflicts needing Jesse's call

Ordered by how much work each one blocks. Each is a place where the board or
the design says one thing and a recorded decision (`docs/product-context.md`
§3, `CLAUDE.md`) or the build says another. None is picked here; the
recommendation, where there is one, is marked.

1. **Member credential: icon key vs. email + password.** *FigJam* gives caregivers email + password; *Figma* gives **every** member name → required email → password (min 5), email+password login, no forgot-password, and no icon picker anywhere (README 06). *Record:* the two-icon key **is** the password (A-1, CLAUDE.md), recovery is superadmin re-issue (A-3), contact details never required (R-7). Options: (a) keep icons, treat the password screens as superseded, add an *optional* email later for reminders and caregiver mail; (b) passwords replace icons — icons nullable, email-keyed login, a member reset flow, and the memory barrier A-1 was designed around comes back; (c) both, icons default (the dormant `custom_password` path in `auth.py:118-165` is the seed). **Blocks:** the whole onboarding modal redesign, A-8, R-7, the share-mail greeting, member password reset. *Recommend (a).*
2. **Saved sidebar + drag-left vs. bottom save zone + full-screen saved overlay.** Every card/list frame draws a persistent left sidebar with a dashed drop zone and a collapsed rail; the card is dragged **left**; the design's ↓ button is *next card*. The build drags **down**, ArrowDown *saves*, ↑ opens the saved list, and all six save paths (X-1), the fly-to-target animation and reduced motion (X-7) are wired to that. **Blocks:** P-5 mobile (the layout would be cut twice), D-14 list view chrome, O-2 tour content, D-15. Options: (a) adopt the sidebar and re-wire all six paths together (L); (b) keep the bottom zone, take the sidebar's *content* (thumbnails, count, actions) as the collapsed rail on wide screens only. *Recommend deciding before any member layout work.*
3. **Save and internal registration are one record vs. save as a bookmark, register later.** Today a save on an internal+signup program *is* the registration (`EventActions.tsx:12`), and a grant report can't tell "bookmarked" from "signed up". The board's note "Do we really want users to automatically sign-up?" and its bookmark framing want them split; the design's saved page and modal only ever say Save / Un-Save. Splitting = `event_attendees.status` gains `registered`, a Register action from Saved, capacity counted on `registered`, an "I registered on their site" confirmation for external. **Blocks:** R-9, and what M-1 / D-7a count.
4. **Filter chips: filter or sort, and which words.** The same chip row is titled "EVENT FILTERS" (543:12713) and "SORT EVENTS BY 0 FILTERS" (399:9447); the accordion component is multi-select checkboxes. The record allows only the member's *explicit* cost/organization filters to remove cards; interests sort (D-1). The chip vocabulary FREE / SPORTS / FOOD / SOCIAL / ART / GAMES / INFORMATIVE is **not** `CATEGORIES` — that half is not a decision: the chips must render the canonical list (CLAUDE.md, D-1a/D-1b). The decision is whether topic chips *filter* (as explicit choices, allowed) or *sort-boost*. **Blocks:** D-10, D-13 placement. *Recommend: FREE / organization / this-week filter; topic chips filter too, as the member's explicit act — never the profile's interests.*
5. **Public attendance count.** "20 Attendees" / "20 People Going" on every member card and console card (design), "tells the user who is going" and "registration mandatory even for drop-ins so we can count" (board). Record: D-7 attendance private; M-1 console counts descoped. The data already exists for every state (a save writes a row), so the question is display and label: show an aggregate count to members and NPOs (yes/no), and call it "saved" or "going" (a save is not attendance). Never names without A-8. **Blocks:** D-7a, M-1 wording, and the board's drop-in question (do not add a registration *step* to drop-ins either way).
6. **What "guest" is.** FigJam: "Sign-up as guest → input necessary information → saved". Figma: a "Continue as guest" button and a guest toast — under a header that shows a signed-in "Sophie L." Record: browsing is already open and saving needs an account (§3.7, R-3); an attendance row needs a `users` row (FK `RESTRICT`), so a "guest" is an account with a name and no key — unrecoverable. Options: (a) guest = anonymous (built; the toast is a one-line nudge); (b) guest = `auth_type='guest'` name-only account with a claim path, which makes P-3a (creation cap) urgent and reopens name enumeration. **Blocks:** R-10, the sign-in modal chooser. *Recommend (a).*
7. **Shareable saved-list link.** 465:14401 offers "Share by Link — Https//SamKWEventslist": a public URL to a member's saved programs, no approval step, for a vulnerable population. D-7 recorded "with known people, with approval". If wanted: opt-in token creation, revocation, `noindex`, and an expiry. **Blocks:** M-11.
8. **Important Links ×3 vs. the typed `registration_url`.** The v2 form replaces the single Posting link with three untyped links (483:12966); the modal, details page, print and mail all show a LINKS list. §3.1's four registration states hang off `registration_mode` + `registration_url`; three untyped links cannot tell the member app which one is the sign-up. Options: (a) keep the typed registration link and add up to two "more links" (`events.links`); (b) Link 1 = registration by convention (fragile). **Blocks:** N-9. *Recommend (a).*
9. **Per-person organizer identities vs. one login per organization (§3.5).** The superadmin table (486:14826) lists several named people per agency; the NPO create page (403:15951) asks first/last name; the header says "Sophia L. / Admin". Record: `Host` *is* the org, one shared login, revisit only if an agency asks (A-6). Options: (a) show the organization in the Name column (today), drop the person fields; (b) store contact names on the host as display-only; (c) reopen §3.5 (per-staff accounts, audit trail, off-boarding). **Blocks:** N-10 invite form shape, the console header copy.
10. **Member profile pictures.** FigJam sticky (76%); the design shows only a coloured avatar circle. The icon is the password and must not become the picture (`LoginOverlay.tsx:182`) — and `SavedEvents.tsx:147` currently renders `icons[0]`; that comes out in Phase 0 regardless. Decide: (a) member-uploaded photo (new member upload route, moderation on a shared platform); (b) a chosen emblem from a set outside the icon pool; (c) nothing — the org logo is the recognition picture that shipped. **Blocks:** A-11.
11. **Mail sender and branding.** The templates (465:14503, 469:16790) and the organizer pages carry "KW Habilitation" / "KWEvents tool"; the app and console say The Belonging Collective; `MAIL_FROM` is one mailbox that six agencies' members would send through. Decide the product name on outbound mail and pages, and whose address sends. **Blocks:** P-6 templates, N-10, M-10.
12. **Restricted event sets + access requests.** FigJam Access Control sticky (85%). *Unlisted* (hidden from the feed, open by link) is compatible with "events are publicly browsable" (§3.7) and cheap (A-9). *Restricted* needs a member↔organization relation and a request queue landing on the org's single shared login. Decide whether restricted is in this iteration or unlisted covers the closed-group case. **Blocks:** A-10.

**Confirmations, not decisions** — the record already answers these; one line
each so they are not re-litigated by "matching the Figma":

- **Delete → "Un-publish".** v2's word is right for what the API does (archive + restore). Adopt it in the modal, toasts and `DeleteConfirmModal`; keep §3.8's rule (owners may un-publish their own unsaved program; anything else is KW Hab's) and re-word N-5, not the route.
- **Console form scope.** v2 draws Name / Date / Time / Location / Description / Links / three tag pairs; the code also has category (interest matching depends on it — CLAUDE.md), pricing detail, recurrence (the 273 imported occurrences), capacity (R-6), ages (D-6), notes, youth, access tags (D-8). Keep every field; the design is showing the common case. Required set stays image + description + category too (N-1).
- **Superadmin surfaces.** Keep the Users tab (member key reset, A-3), the Access column and Make superadmin (N-4), the Remove confirmation with the program count (removing an org archives its programs), and Undo on the publish toast (N-6). The design simply never drew them.
- **Share and print on console rows.** v2 cards have only View Details; N-7 requires copy-link on every row. Keep the row icons and add them to the details page too.
- **NPO special link = the invitation.** 403:15951 is `/host/invite/[token]` with cosmetic changes; the email-verification code (404:16111) duplicates what the invite link proves. No host signup route (§3.2) holds.
- **Edit as page vs. modal.** Either satisfies N-2 (shared `EventForm`). If the details page (N-11) is built, give edit its sibling route.
- **Copy (§3.3).** "Login to start saving events.", "Create an account to save events to your page and calendar", "We will send a link to add the event to their calendar." are explanations on the member surface; they become labels when built. Design copy bugs not to ship are listed in README conflict 14.
- **Onboarding tour** must be pictograms and single words, spoken by TTS — not tooltip paragraphs.
- **CLAUDE.md console description** is stale for `/host/events` (see TL;DR). Docs fix.
- **Hosting** (§3.6) stays open; neither source touches it.

---

## 6. Phased implementation plan

Sizes: S ≤ 1 day, M 2–4 days, L a week or more. "Migration" means an Alembic
revision that must run against prod before deploy (`CLAUDE.md`, P-1). Items
marked *design* come from the Figma page (§7); the rest from the board.

### Phase 0 — quick wins (high impact, low effort). No decisions needed.

| ID | Item | Scope | Size | Depends on | Acceptance |
|---|---|---|---|---|---|
| **R-8** | Add to calendar (`.ics` + Google template link) | BE: `GET /events/{id}/calendar.ics` and `GET /users/me/events/calendar.ics` (`text/calendar; charset=utf-8`, `Content-Disposition: attachment`, public for the event route, `deleted_at IS NULL`, series-aware when the caller is enrolled). FE: `lib/calendar.ts` builds the Google URL; "Add to calendar" on `RegisterPrompt` (after Save/Register), `EventDetailModal` (when saved), saved-panel cards and the saved page's list-level button, `app/events/[id]`. | S | — | Saving a program then pressing the button downloads a file that imports into Apple Calendar and Outlook with the right title, time, location and a link back; the Google link opens a pre-filled event; the list route contains every upcoming saved program. Undated programs show no button. Times are correct in America/Toronto. |
| **D-11** | Date and time legible on every member surface | FE: `FeedParts.tsx` `WideEventCard` shows relative date ("In 7 days"), weekday + date, start–end time as a display-weight line under the title; `EventDetailModal` and `GridCard` the same; a shared `whenLabel` in `lib/time.ts` (the existing one is unused). SR announcement includes the time (`EventsView.tsx:777-789`). | S | — | Every card and modal shows the start time (and end time when present); the date/time line is at least as large as the description and visually second to the title. |
| **D-12** *(design)* | Tag pills on every card | FE: a `Tag` primitive (Free/Paid · Drop-in/Sign-up · In-person/Virtual, the design's six colours) derived from `is_free`, `requires_signup`, `is_virtual` — the same derivation `lib/dimensions.ts:77-124` already does for grouping; rendered on `WideEventCard`, `GridCard`, `EventDetailModal`, `/events/[id]`, `PostedEventCard` (replacing its `Pill`s). | S | — | Every surface shows the same three pills for the same program; pills carry text, not colour alone; no pill for a state the data doesn't assert. |
| **D-10** | Visible filters on the feed | FE: a chip row above the stepper/list — Free · Paid · This week · organization (multi) — driven by client-side filtering (the feed already holds every row, `app/page.tsx:26-35`); grouping (`SeeEventsBy`) stays. Chip labels come from `CATEGORIES` / dimensions, never a hand-typed list. Filters are the member's explicit choice, so they may hide cards; personalization still only sorts. Filter state announced to the live region; the keyboard handler ignores the chips (`EventsView.tsx:814-823` already skips inputs). Topic chips wait on §5.4. | M | §5.4 for topic chips only | A member can reach Free-only or one organization in one tap from either view; clearing returns every program; chip state survives switching views; no cards are hidden by anything except the chips. Register D-2/D-3 flip back to ✅. |
| **UX-0** | Remove the TEMPORARY "Staff sign-in" link from the feed | FE: delete `EventsView.tsx:954-967`; the overlay's link stays (`LoginOverlay.tsx:326-334`). | S | — | Feed carries no staff affordance. |
| **A-11a** | Stop rendering the sign-in icon on the saved panel | FE: `SavedEvents.tsx:147` renders `emojiFor(me.icons[0])`, the first icon of the two-icon credential; replace with a neutral emblem (🔖) until A-11 decides otherwise. | S | — | No icon slug is visible anywhere except the sign-in screens. |
| **D-16** *(design)* | Member labels and confirmations match the design | FE: "Expand" → "More information →" (`FeedParts.tsx:307`); account chip shows "First L." (design) — already `${first_name} ${last_name.charAt(0)}.` at `EventsView.tsx:948`, keep; visible toasts for "Successfully logged in" and "*title* was unsaved [Undo]" (Undo = re-`POST /attend`), both mirrored to the `aria-live` region (`EventsView.tsx:926`); "See on Map" opens a Google Maps search URL for `location`; the saved variant of the detail modal gets **Un-Save Event** instead of a disabled "Saved ✓" (`EventDetailModal.tsx:143-153`), so un-save exists on the card *and* in the modal. | S | — | Each toast is visible for ~5 s and announced once; Undo restores the save without a reload; the modal can un-save; "See on Map" opens a new tab with the address searched. |
| **M-1** | Signup counts in the console | FE: `PostedEventCard` shows "N saved · M clicked through" on every row (data already on `EventOut.saved_count`; add `click_count` to `EventOut` from `event_registration_clicks`, indexed by `event_id`). BE: one aggregate query in `_EVENT_OUT_OPTIONS` style, not per row. Label "saved", not "attendees", until §5.5. | S | — | Every console row shows both numbers; superadmin view sums per organization at the top of the list. No N+1. |
| **N-11a** *(design)* | "Un-publish" wording | FE: `ConfirmDelete`, `DeleteConfirmModal.tsx` (delete the unused one), toasts and the row button say Un-publish / "was un-published"; API unchanged. | S | — | The word "delete" no longer appears on the console; Undo still restores. |
| **N-12** *(design)* | Form parity: end time, description cap, Your/All toggle, empty state | FE: `EventForm` asks for an end time (`ends_at` is already accepted, `EventForm.tsx:386-394`, and propagated across a series, `events.py:209-220`); `maxLength=1000` on description with a counter; a Your Events / All Events toggle over the list (client-side on `host_id`); the Your-Events empty panel with a Create button. BE: server-side 1000-char cap on `description`; optional `mine=true` on `GET /events`. | S | — | A program can be posted with an end time and shows a time range everywhere; a 1001-char description is refused by both ends; an admin can flip between own and all programs in one click. |
| **M-8** | Printable poster / list with QR, console and member side | FE: `/host/events/print?ids=…` (console-only page) rendering one poster per program (title, date/time, location, org logo, QR to `/events/{id}`) or a one-sheet weekly list; QR generated client-side (`qrcode` package, SVG). "Print poster" on each console row, "Print this week" in the header. Member side (design 465:14216, 471:5101): "Print list" on the saved page and "Print" on the detail modal, using the same component and the existing print CSS. | S/M | — | Printed poster fits Letter, QR scans to the public page, text ≥ 14pt; a member's printed list contains every upcoming saved program; the existing single-card print keeps working. |
| **M-9** | Share from the member surface | FE: Share button on `EventDetailModal` and `app/events/[id]` — `navigator.share` when present, copy-link fallback, live-region confirmation. (Share by email is M-10, Phase 1.) | S | — | On a phone the native share sheet opens with the public URL; on desktop the link is copied and announced. |

### Phase 1 — high impact, medium effort. Items marked wait on a §5 decision.

| ID | Item | Scope | Size | Depends on | Acceptance |
|---|---|---|---|---|---|
| **P-6** *(design)* | HTML mail | BE: `core/mail.py` gains a multipart path (plain text + HTML, optional `.ics` attachment, inline logo), templates for invite, share-event, share-list; the existing "unset SMTP → log" behaviour kept; prod `SMTP_*` verified. | S/M | §5.11 (branding, sender) | A test send renders in Gmail, Apple Mail and Outlook with the logo, one event row and a working button; plain-text fallback reads correctly. |
| **N-10** *(design)* | Emailed organizer invites | BE: `POST /invites` mails the accept link (`FRONTEND_ORIGIN` + token) to the invited address via P-6; still returns the link for the superadmin to paste as a fallback. FE: invite modal gets "Send" and shows the sent state; keeps the organization field (`HostInvite` requires it — §5.9). | S | P-6 | The invitee receives a mail whose link opens `/host/invite/[token]`; a second send rotates the token; the superadmin can still copy the link. |
| **O-1** | View preference at onboarding, persisted | Migration: `users.preferred_view text not null default 'carousel'`. BE: `UserPrefsUpdate.preferred_view`, `UserOut`. FE: a two-tile step in `/signup` (pictogram + one word: "One at a time" / "List"), same control in the settings dialog; `EventsView` initial `viewMode` from `initialMe`; signed-out default carousel. When TTS/voice/head are on, default carousel and say why in one line. | S/M | D-14 for the "List" tile label | A member who picks List at signup lands in it on every visit and device; switching the toggle updates the preference; signed-out visitors are unaffected. |
| **D-14** *(design)* | List view (rows) as the second mode | FE: `components/member/ListFeed.tsx` — full-width rows (photo, pills, title, date/time, location, count, "More information →") with hairline dividers, the same sections/dimension grouping and search as the grid, "N unique events" heading; `ViewToggle` gains labels. The grid stays available as a third variant or is retired — designer's call, not a blocker. Keyboard and announcement care as the carousel (X-4, X-8). | M | D-11, D-12 | Each row is one program; rows are reachable by keyboard in order; the list never hides a program the carousel shows; no horizontal scroll at 1024px. |
| **D-7a** | "N going" for members | FE: count on `EventDetailModal`, `/events/[id]` and cards from `saved_count`; label per §5.5. Hidden when 0. | S | §5.5 | The number matches the console's count for the same program; no names are exposed anywhere member-facing. |
| **A-9** | Unlisted programs | Migration: `events.visibility text not null default 'public'` + partial index on `(visibility, starts_at) where deleted_at is null`. BE: `list_events` filters `visibility = 'public'`; `get_event` and the `.ics` route serve unlisted by id; sitemap excludes unlisted; `EventCreate/Update` accept `public|unlisted`. FE: host form toggle "Listed in the feed / Only people with the link"; console pill; share link unchanged. | M | — | An unlisted program never appears in the feed, list, saved-panel "recommended" or sitemap for anyone; its link opens, saves and registers normally; its saves count in the console. |
| **N-9** *(design)* | Important Links | Migration: `events.links jsonb not null default '[]'` (`[{label, url}]`, max 3). BE: on `EventCreate/Update/Out`, `normalize_url` per link, `registration_url` stays the typed sign-up link (§5.8 a). FE: three optional label + URL rows in `EventForm`; LINKS section in `EventDetailModal`, `/events/[id]`, the console details page, print and mail. | M | §5.8 | A host can add up to three links with labels; they render in every member surface and print; the registration link is still the only thing the four registration states read. |
| **N-11** *(design)* | Console event details page | FE: `/host/events/[id]` read-only page (photo, facts, description, links, pills, counts) with Edit / Un-publish / Share / Print in the header; another organization's program opens read-only with Share only; edit moves to `/host/events/[id]/edit` around the same `EventForm`; the publish toast lands here (with Undo). | M | N-12, N-9 | Every card's View Details opens the page; a plain admin can read any program in full but edit only their own; N-2, N-6, N-7 still hold. |
| **M-10** *(design)* | Share by email (one event, saved list) | BE: `POST /events/{id}/share {to_email}` and `POST /users/me/events/share {to_email}` — signed-in members only, rate-limited per member and per IP (`core/rate_limit.py`), recipient address never stored, HTML mail via P-6 with the `.ics` attached (R-8) and the public URL(s); greeting uses the member's first name only (no `{caregiver_name}` — A-8). FE: the design's share modals (472:12046, 465:14401 email half) on the detail modal and saved page. | M | P-6, R-8, §5.11 | A member can send one program or their list to a typed address; the mail arrives with the calendar file and links; a signed-out visitor cannot send; 20 sends in 15 minutes are refused. |
| **D-13** | "For you this week" | Migration: `users.dismissed_program_ids text[] default '{}'`. BE: `UserPrefsUpdate` accepts it. FE: `lib/feed.ts` `recommended(events, taste, dismissed, now)` → top 6 by `matchScore > 0` starting within 7 days; first stepper bucket in the carousel and first section in the list, dismiss (✕) on each card in that group only; the program still appears in its normal bucket. Only for signed-in members with ≥1 interest or need. | M | D-10 (shares the header space) | The group appears only when it has ≥1 program; dismissing removes it from the group on every device and never from the feed; the live region announces "For you this week, n programs". |
| **R-9** | Saved vs. registered | Migration: `event_attendees.status` gains `registered`; backfill existing `saved` rows on `internal + requires_signup` programs → `registered`. BE: `POST /events/{id}/register` (internal only, capacity counted on `registered`), `POST /events/{id}/registered-elsewhere` (external, self-reported), `attend` no longer registers. FE: `RegisterPrompt` and detail modal branch Save vs Register; saved-page cards get "Register" / "I signed up on their site"; return-from-external prompt on next focus. Counts (M-1, D-7a) split. | M | **§5.3** | A member can bookmark a registration program without a place being taken; registering takes the place; the console distinguishes the two counts; capacity refuses only registrations. |
| **P-5** | Mobile and tablet | FE only. Carousel: under `sm` the card becomes a portrait stack (image top, text below, `max-h` from viewport), arrows become two buttons under the card, the save target compacts to one control; `main` allows vertical scroll below the card; `touch-action: pan-y` on the drag surface, drag thresholds scaled to viewport. Overlays (`LoginOverlay`, `EventDetailModal`, `RegisterPrompt`, saved page) go edge-to-edge under `sm` with 16px gutters and a 4-column icon grid. List view rows stack under `sm`. Console: `px-4 sm:px-8`, filter panel becomes a collapsible drawer under `lg`, list column `min-w-0`, card image `w-24 sm:w-[150px]`, `EventForm` single column under `md`. Test on iPhone SE (375), iPad portrait (768), iPad landscape (1024). | L | **§5.2**, D-10, D-11, D-12, D-14 | No horizontal scroll at 360px on any member or console page; all controls ≥ 44px; drag-to-save works on touch without scrolling the page; head-tracking calibration fits a tablet; `npm run build` and typecheck clean. |

### Phase 2 — high impact, high effort, or blocked on a decision

| ID | Item | Scope | Size | Depends on | Acceptance |
|---|---|---|---|---|---|
| **D-15** *(design)* | Saved sidebar + drag-left | If §5.2 (a): FE — persistent left panel on ≥`lg` (count, dashed drop zone that tints on drag, thumbnails, See Saved Events / Add to calendar), collapsible to a 100px rail; card drag **left** with the design's lift/rotate; `dropRef`, fly-to-target, hold-to-save and the arrow-key map re-pointed together; ↓/↑ become next/back on screen; the saved list becomes a page (`/saved`) with Upcoming \| Past tabs. If (b): the rail only, on wide screens, with the bottom zone kept. Either way reduced motion honoured (X-7). | L / M | **§5.2**, P-5 | All six save paths (X-1) land in the same target; the live region announces the drop; on a phone the sidebar is absent and the compact save control works; no path saves a program that is not on screen. |
| **O-2** | First-run navigation tour | Migration: `users.onboarded_at timestamptz null`. BE: `UserPrefsUpdate.onboarded` sets it. FE: `components/member/FirstRun.tsx` — three full-screen pictogram steps (→ Next, Save, List), one word each, "Skip", spoken by `useTextToSpeech` when on, dismiss persists (`onboarded_at` signed-in, `localStorage` signed-out), "Show me again" in the settings dialog; keyboard handler paused while open (add to the overlay list at `EventsView.tsx:828`). Step art depends on §5.2's gesture. | M | O-1, §5.2 | A new member sees the tour once per account (not per device), can skip in one tap, can replay it; a screen-reader user hears each step; copy is ≤ 3 words per step. |
| **F-1** | In-platform feedback (no external API) | Migration: `feedback(id, user_id null, event_id null, host_id, kind ∈ {more_like_this, less_like_this, note}, text null, created_at)`. BE: `POST /feedback` (rate-limited by IP like clicks, anonymous allowed), `GET /feedback` host-scoped (own org; superadmin all). FE: on `EventDetailModal` and saved-page cards, "More like this? 👍 👎" and an optional note field with a mic button (a new `useDictation` hook — `useSpeechCommands` is a keyword matcher, per `agent-handoff.md` §2); console tab "Feedback" listing by program. | M | — | A member can answer in one tap without leaving the modal; a note can be dictated; each organization sees only feedback on its programs; the conversational AI interview can later write into the same table. |
| **M-11** *(design)* | Shareable saved-list link | Migration: `saved_list_shares(token_hash, user_id, created_at, revoked_at, expires_at)`. BE: `POST /users/me/events/share-link` (opt-in, one live token per member, revocable), public `GET /shared/{token}` (upcoming saved programs, `deleted_at` filtered, `noindex`). FE: the modal's "Share by Link" half, a `/shared/[token]` page reusing the list rows, revoke in settings. The mail's "View Events on our Platform" button lands here. | M | **§5.7**, P-6, M-10 | A link is created only on the member's explicit tap, shows only upcoming programs, stops working when revoked or after expiry, and is not in the sitemap. |
| **A-10** | Restricted programs + access requests | Migration: `memberships(user_id, host_id, status ∈ {requested, approved, declined}, created_at, decided_at, pk(user_id, host_id))`; `events.visibility` gains `restricted`. BE: feed shows restricted programs only to approved members (title/org visible to others with "Ask to join" — or fully hidden, to decide); `POST /hosts/{id}/join` (member), `GET/PATCH /hosts/me/requests` (that org's login only). FE: "Ask to join" on restricted cards, request list in the console with approve/decline, member sees status on the card. | L | **§5.12**, A-9 | A request reaches only the organization it names; an approved member sees and can save the org's restricted programs; nobody else can open them by link; superadmins can see every queue. |
| **A-8** | Caregiver-linked accounts | Migration: `care_links(caregiver_id, member_id, status, created_at)`. BE: link by member name + key entered on the caregiver's device (consent = the member's own key), `GET /users/me/care` returns linked members' saved lists read-only. FE: "People I support" in the settings dialog; saved page gains a switcher; caregiver can save *for* a member only with the member's key present (support, not proxy). Share mail can then greet a named caregiver. | L | **§5.1** | A caregiver sees a linked member's saved programs; no member's key is ever displayed; unlinking is one tap on either side; nothing on the member surface asks for an email. |
| **A-11** | Member profile picture | If §5.10 picks (a): migration `users.avatar_url`; BE member-scoped upload route reusing `_sniff_image_type` and the 5 MB cap; FE `ImageDrop` in the settings dialog, shown on the account chip and saved-page heading. If (b): a fixed emblem set outside the icon pool, no upload. | M / S | **§5.10** | The picture appears on the chip and saved page; it is never one of the twelve sign-in icons; upload rejects non-images and > 5 MB. |
| **R-7** | Reminders (board: "option to send email notifications"; design: "send all your saved events to your email") | Only if §5.1 allows an *optional* email. Migration `users.email null` (not unique); a scheduled sender (Vercel cron → `POST /internal/reminders`) using P-6. | M | §5.1, P-6 | Members with an email get one reminder 24 h before a saved program; members without one see nothing different; email is never required at signup. |

### Explicitly not planned

Transportation assistance; emailed recommendation digests (no member email);
community-added events with a "posted by" tag; audience detection from
account context; an in-platform organizer calendar; a map view (until D-4
gives programs coordinates); true Google Calendar sync (§4); an NPO
email-verification code step (the invite link already proves the mailbox);
member password login and reset (unless §5.1 chooses (b) or (c)); an
edit-Undo on the console (needs a row snapshot for no real gain).

### Order of work, if the decisions come back in the expected shape

R-8 → D-11 → D-12 → UX-0 → A-11a → D-16 → M-1 → N-11a → N-12 → D-10 → M-9 →
M-8 → P-6 → N-10 → O-1 → D-14 → A-9 → N-9 → N-11 → D-7a → M-10 → D-13 → P-5 →
D-15 → O-2 → F-1 → (R-9, M-11, A-10, A-8, A-11, R-7 as decided).

---

## 7. Design-file findings

_Merged from the Figma "Final" page analysis, 2026-09-27. Frame-by-frame
detail: `docs/design/final/README.md` and the four part files._

**Which frames are current.** The Card & List view frames re-edited at ids
543–546 are the latest member chrome; the "Community Member use flow" frames
461–491 are the latest saved page, detail modal and share/print flow; the
Admin sections 481–486 are the current console. The 404-series admin frames
and the 399–446 saved-panel frames are earlier passes, kept only where they
alone show a state (expanded filters, delete confirm, three toasts, the unsave
toast). Six frames are retired outright (README 99). The Hover States Guide
section is empty.

**What the design adds that the board did not** (and where it landed):

| Design element | Frames | Status today | Folded into |
|---|---|---|---|
| Persistent saved sidebar, dashed drop zone, collapsed rail, drag-**left** | 543:12713, 399:9447, 399:9643, 435:10236 | ❌ — build drags down to a bottom zone; saved list is an overlay | **D-15** (Phase 2), decision §5.2; P-5 waits on it |
| List view of rows (`Member - Listed Event`), "24 Unique Events" | 393:7397, 399:6259 | 🟡 — second mode is a grid | **D-14** (Phase 1); O-1's tile label |
| Chip row FREE / SPORTS / FOOD / SOCIAL / ART / GAMES / INFORMATIVE; multi-select filter accordion | 543:12713, 399:9447, 404:21254 | ❌ — no filters, vocabulary not `CATEGORIES` | **D-10** (same item as the board's "filters more visible"); decision §5.4 on filter vs sort; vocabulary is not negotiable |
| Tag pills, relative date, time range, "20 Attendees" on every card | all card/list/modal frames | ❌ pills/count, 🟡 date | **D-12** pills, **D-11** date/time, **D-7a** / **M-1** count (decision §5.5) |
| "More information →" / "Save event 🔖" on the card; "Event Saved" disabled state; Un-Save in the modal | 543:12713, 399:9643, 461:11216 | 🟡 | **D-16** |
| More Information modal: Share, Print, LINKS, See on Map | 399:8255, 469:15593 | 🟡 | **M-9/M-10** share, **M-8** print, **N-9** links, **D-16** map link |
| Saved page with Google Calendar / Share list / Print list, Upcoming \| Past tabs | 468:14558, 399:10360 | 🟡 | **R-8**, **M-10/M-11**, **M-8**; tabs ride with D-15 |
| Unsave toast with Undo; "Successfully logged in" toast; guest toast | 431:13693, 404:29510, 404:28235 | ❌ (announced, not shown) | **D-16**; guest toast waits on §5.6 |
| Share one event / the list by email; share list by link; two mail templates | 472:12046, 465:14401, 465:14503, 469:16790 | ❌ | **P-6** HTML mail, **M-10** email, **M-11** link (decision §5.7); branding §5.11 |
| Print previews (list, single event) | 465:14216, 471:5101 | ❌ member side | **M-8** |
| Sign-up modal chooser; name → **required email** → password; email+password login | 399:12190 … 404:29057 | ❌ | **§5.1** — nothing scheduled until decided; A-4 (typed name) unchanged |
| "Continue as guest" | 399:12190, 404:28235 | 🟡 (anonymous browsing exists) | **R-10**, §5.6 |
| NPO special link → create account → email code → login | 403:15951, 404:16111, 404:16160 | 🟡 — the link is the invite; code step redundant | A-7 confirmed; §5.9 on person names; code step not planned |
| Console: Your/All toggle, View Details page, "Un-publish", end time, 1000-char cap, Important Links ×3 | 481:5307, 486:14236, 483:12966 | 🟡 / ❌ | **N-12**, **N-11**, **N-11a**, **N-9** |
| Superadmin: emailed invites; Account / Event Management switch; multi-person org table | 486:14826, 486:14643 | 🟡 | **N-10**; §5.9; Users tab and Access column kept (confirmations) |

**Backend work the design implies**, deduplicated against the board's IDs:
R-8 (`.ics`), P-6 (HTML mail), M-10 (share by email), M-11 (share link),
N-9 (`events.links`), N-10 (emailed invites), N-12 (description cap, `mine=`).
Conditional on §5: member email (A-8/R-7), member password login, guest
accounts (R-10), organizer contact names. Nothing else — counts, pills, times,
undo-unsave, print, map link, details view and un-publish are all served by
the current API.

**Where the design and the record disagree** is merged into §5 (decisions
1, 2, 4, 5, 6, 7, 8, 9, 11) and the confirmations list; the README's conflict
list carries the frame-level detail.

**Copy bugs in the design not to ship:** "List of Sam's Events" on the
single-event print; "Share list of events?" / "a list of Event" on the
single-event share; "Event deleted" toast reading "posted"; "Enter your first
name" as the event-name placeholder; "Login to start saving events." on the
signed-in and console empty states; the Card/List toggle highlighting the
wrong mode on 393:7684; "0 Saved Events" beside a populated sidebar.
