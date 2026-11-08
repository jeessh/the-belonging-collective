# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# The Belonging Collective

Accessible, needs-first community-programming platform for Kitchener-Waterloo
nonprofits (hackathon build). Members discover/attend programs via a tactile,
one-card-at-a-time UI; members and organizers both sign in with an
**email + password**. (Icon keys — a 2-icon key that was the password — were
retired 2026-09-28; see Gotchas.)

## Layout
- `backend/` — FastAPI + SQLAlchemy. **Source of truth for the API.**
- `frontend/` — Next.js (App Router) + Tailwind + Framer Motion. Two distinct
  surfaces: the member app (`/` is the feed, `/signup`, and the public
  per-program pages at `/events/{id}`) and the staff admin console (`/host/*`).
  They deliberately do not look alike — see below. There is no `/events` index
  route — the feed is the home page, and `/events` 307s to it.
- `vercel.json` (root) — single-origin deploy: `/api/*` → backend, `/*` → frontend.

## Run locally
```bash
# backend → http://localhost:8000
cd backend && .venv/bin/uvicorn app.main:app --reload
# frontend → http://localhost:3000
cd frontend && npm run dev
```
`backend/.env` (gitignored) holds `DATABASE_URL` + `JWT_SECRET`. Apply the schema
with `.venv/bin/alembic upgrade head`, then seed with
`.venv/bin/python -m app.seed` (idempotent; skips if hosts exist).

**Alembic owns the schema.** Nothing creates tables on startup any more —
`create_all` only ever emitted `CREATE TABLE IF NOT EXISTS`, so a new column
worked locally and then 500'd every query in production against the un-ALTERed
table. Model change → `alembic revision --autogenerate` → deploy → run
`upgrade head` against prod. The baseline revision is idempotent so it is safe
against the hand-provisioned Supabase database; no `alembic stamp` needed.
Frontend also has `npm run typecheck` (`tsc --noEmit`) and `npm run build`.
Interactive API docs: http://localhost:8000/docs. **There is no test suite,
linter, or CI** — verify changes by running the app and typecheck.

## Self-hosted production (KWHab) — rules for every change
KWHab deploys production from **release tags** on its own server + Postgres
(not Vercel/Supabase); the Vercel site is ours. So:
- **Never edit a migration that is in a released tag.** Add a new revision.
- **Every new env var goes in `backend/.env.example` or
  `frontend/.env.example`** in the same change, and in the release notes.
- **Nothing may require Vercel or Supabase.** Uploads go through
  `core/storage.upload_image`, which honours `STORAGE_BACKEND=local`
  (`UPLOAD_DIR`, `UPLOAD_PUBLIC_URL`; served by `main.py` at `/uploads/{name}`).
  Any new Vercel-only feature (cron, etc.) needs a plain-HTTP equivalent.
- Releases: `vX.Y.Z` tag + GitHub release listing new env vars and migrations.
  See README "Self-hosting".
- **Merging to `master` is not a release** — KWHab only picks up a tag. Any
  collaborator may merge their own PRs (squash) and cut a release; no review
  is required. Before tagging, check every change since the last tag
  (`git log <last-tag>..master`) and put all new env vars, new migrations and
  anything their admin must do in the release notes.

## Database (Supabase)
- Project ref `xybhshhcgdvfgryklsze`, region `aws-1-us-west-2`.
- Pooler host `aws-1-us-west-2.pooler.supabase.com` — **:5432 session** (local),
  **:6543 transaction** (serverless/Vercel). URL prefix must be `postgresql+psycopg://`.
- Auth is **custom cookie-based** (not Supabase Auth); RLS is intentionally off —
  never expose the anon key or hit the DB from the browser.

## Same-origin deploy (why it matters)
Auth cookie is `SameSite=Lax`, frontend fetches with `credentials:"include"`, so FE
and BE **must share one origin**.
**Members and organizers have separate session cookies**: `COOKIE_NAME`
(`kwcc_session`) for members, `COOKIE_NAME` + `_host` for organizers
(`deps.cookie_name`). `set_auth_cookie` picks one from the token's role, so
both can be signed in in one browser; `POST /auth/logout?role=host` ends only
the console's, `GET /auth/me?role=host` reads only it. An organizer token
still sitting in the shared cookie (from before the split) is honoured. In prod set `NEXT_PUBLIC_API_URL=/api`; FastAPI
uses `settings.ROOT_PATH` (`""` local, `/api` prod).

Required prod env: `DATABASE_URL` (:6543), `JWT_SECRET`, `COOKIE_SECURE=true`,
`NEXT_PUBLIC_API_URL=/api`, `FRONTEND_ORIGIN`, `ROOT_PATH=/api`, `CRON_SECRET`
(Vercel Cron sends it as `Authorization: Bearer …` to `/api/internal/reminders`,
scheduled in the root `vercel.json`; unset, the endpoint refuses to run rather
than running open).

Optional: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (an OAuth web client
whose redirect URI is `https://<site>/api/google-calendar/callback`, or set
`GOOGLE_REDIRECT_URI`) turn on "Connect Google Calendar"; unset, the calendar
buttons subscribe to a feed instead. See "Google Calendar" below.

All outgoing mail — password resets (member and organizer), invitations,
member reminders and change notices — needs SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASSWORD`, `MAIL_FROM` (plus `SMTP_STARTTLS` / `SMTP_SSL`). Every message
goes through `core/mail.send` as plain text plus a branded HTML alternative
(wordmark, one message block, one button), from "The Belonging Collective"
(`MAIL_FROM_NAME`; `MAIL_FROM` stays the address). **Unset means no mail is sent
and the message is written to the log instead** — right for local dev, never
acceptable in production. `FRONTEND_ORIGIN` is what the links in that mail (and
in the `.ics` exports) are built from, so a wrong value produces links nobody
can open.

## Frontend architecture

### Member app
- `components/EventsView.tsx` (~900 lines) is the member feed and orchestrates
  every accessibility mode below. Its parts live in `components/member/`:
  `FeedHeader` (account + the Accessibility Tools menu), `SavedSidebar` (the
  saved column — on a desktop the open panel while nothing is saved and the
  rail once anything is, so a first save folds it; the rail on a tablet; a
  bar under the feed on a phone. Open / Close is the member's choice until
  reload (`sidebarChoice` in EventsView), and the feed waits for the saved
  list before first paint so it never opens-then-folds. Rail and panel are
  one `motion.aside` whose width animates; saved items grow in and fold out
  (`Arrivals`), and the panel keeps its list mounted under the drag message
  so an arrival animates. The open panel is a whiteboard (an
  experiment, `Board` in SavedSidebar): the whole panel is `.whiteboard`
  (globals.css; white); the panel and the rail share one 2px grey
  (`border-line`) edge on the right, the same grey as the top bar's bottom line — a dark "Saved Events"
  heading and grey count, and See Saved Events / Google Calendar as the
  standard secondary `Button`s (large, full width, stacked) at the
  bottom — miniature feed cards (picture and title) each held by a
  coloured square magnet (`Magnet`), in two even columns
  (a plain grid, 16px apart; no dragging or saved positions any more),
  **newest save first, at the top left** (the list has no saved-at time,
  so `Board` remembers arrival order in a ref; the mini card's flight
  lands there); a click opens one. Its forwarded ref is the drop target every save
  animates into, whichever layout is showing — attached by a callback that
  never nulls it, since the two layouts overlap while they cross-fade), `FeedFilters` (FREE +
  topic chips; one scrolling row on a phone), `FeedCard` (the one card, on
  `ui/EventSummary`), `ListFeed` (the rows, with the "For you this week"
  section on top) and `Tour` (the first-run walk-through). The saved list
  overlay (`components/SavedEvents.tsx`) opens from "See Saved Events".
- **The event column has wide margins and a centred, 1200px-at-most
  content width** (64px sides from `lg`, 96px from `xl`): heading, filters,
  card and arrows / list all sit in it.
- **The feed's heading is "Discover Events"** (`h1`), with the counter
  under it as grey 20px subtext ("Event 3 of 47" in card view, hidden from
  screen readers there since the live region reads it; "47 Unique Events"
  in list view).
- **The bar spans the whole width**, over the saved panel and the events
  (in EventsView, before the panel / feed row): the account button
  (`FeedAccount` in `member/FeedHeader.tsx`) on the left, in line with the
  panel's "Saved Events" heading, and Accessibility Tools (`a11yMenu`) on the
  right; the saved panel starts under it. "Saving for" (`CareSwitcher`) sits
  beside the account — except while the saved panel is open (`careInPanel`),
  when it sits under the panel's heading and Close button, the board's full
  width.
- The feed's account button (`FeedAccount`'s `AccountButton`) is the
  member header's one size: a 36px picture and the name at 20px, with
  "Community member" or "Caregiver" (`is_caregiver`) in 16px grey under it, the size of "Accessibility Tools" and the
  "Saving for" switcher beside it, a 20px chevron; its menu items are
  18px with 20px icons, like the header's other menus.
- **Community member or caregiver** (was "Simplified / Advanced"). The
  sign-up flow's account step asks "Are you a community member or a
  caregiver?": a **community member** gets card view (one card at a time),
  a **caregiver** list view. Accessibility Tools has the same choice as an
  "I am a" toggle (Community member | Caregiver), and the profile shows it
  under the name. Signing up or in through the feed's own sign-in sheet
  switches the feed to the account's `preferred_view` straight away
  (`handleSignedIn`), so a new caregiver lands in the list. It is
  `is_caregiver` plus `preferred_view`, written together — at sign-up
  (`is_caregiver` on the sign-up call, then `PATCH /users/me
  {preferred_view}`) and from the "Your experience" toggle at the top of
  Accessibility Tools (`changeExperience` in EventsView: `PATCH /users/me
  {is_caregiver, preferred_view}`; Simplified also resets "Saving for" to
  Me). The View toggle still switches card / list on its own.
  **List view is the console's layout for everyone** — signed out,
  Simplified or Advanced (`member/CaregiverFeed`; `ListFeed` and the "For
  you this week" section are no longer drawn, and Register stands in for
  Save on events that need it):
  `host/PostedEvents`' `FilterPanel` on the left, sticky (`memberView` — the feed's
  groups only, member-app sizes; it replaces the chip row), search, and a
  card per event like `AdminEventCard` (image, tags, when, where, "N
  people saved this event"; the whole card opens the details) with Share and Add to Google
  Calendar as icon buttons with `ui/Tooltip`s, beside Save / Unsave (through
  `attend` / `unsave`, so for whoever "Saving for" names). Restricted to a
  member's actions: nothing edits; a special-access program not yet
  approved has no Save (its details offer Request access).
  **Its cards drag onto the saved panel too** (from `sm`; a phone scrolls):
  framer `drag` held in place (zero `dragConstraints`, no elasticity — the
  card itself never moves, or it slid over the filter panel), the card
  fading while a portalled
  `MiniCardFace` follows the pointer; released over `dropTarget` (the feed's
  `dropRef`) it saves — or, needing registration, opens the Register
  confirm. A drag never also opens the details.
  **The first drag shows a tip** (card view and list view alike): "Drop it on
  Saved Events, on the left, to save it" in a dark bubble over the mini card
  (`DragHint` / `useDragHint` in SavedSidebar), then never again in that
  browser (`tbc.drag_hint_seen`, try/catch). In card view it rides its own
  layer at full strength, since the mini card fades in.
- **Two things a member's profile remembers about the feed itself:**
  `Me.preferred_view` (card | list — the feed opens in it and the toggle
  PATCHes it) and `Me.onboarded_at` (the tour is shown once, and counts as
  seen the moment it **opens** — `PATCH /users/me {onboarded: true}` plus the
  `tbc.toured` flag — not on Start or Skip, so closing the tab mid-tour
  doesn't bring it back; either the profile or the browser having seen it
  is enough). Signed out, both
  live in `localStorage` (`tbc.preferred_view`, `tbc.toured`), every read and
  write wrapped in try/catch. The tour spotlights `data-tour="…"` targets
  (`arrows`, `save`, `more`, `filters`, `view`, `foryou`, `a11y`) — keep those
  attributes when moving a control — and is never mounted over sign-in or
  head-tracking calibration; "Show me around" in Accessibility Tools replays
  it.
- **Layout is desktop-first, reflowed at Tailwind's `sm` / `lg`.** Phone
  (< 640) stacks: the card goes image-over-text with ↑ / ↓ under it and drags
  on the x axis only (`touch-action: pan-y`, so a finger still scrolls);
  `Modal` becomes a full-height sheet with 16px gutters; `EventSummary` rows
  stack everywhere they are used. Tablet keeps the desktop shapes with
  tighter gutters. Anything that has to swap components rather than classes
  (the bar, the console's Filters sheet) reads `lib/useMediaQuery`, which is
  false on the server so the first paint is always the desktop markup.
- **The feed side matches the saved board, lightly**: the event
  column stays plain white; the feed
  card is held up like a flyer (`FeedCard`: a red square `Magnet` at the
  top and a soft shadow, kept straight); and while the card is on the move (`lift` — drag, ← hold, flight)
  its magnet pops off (`unpinned`). The card's text and buttons are untouched.
- **Card view has a 40px cursor** (`.big-cursor` in globals.css, put on
  the feed column while `viewMode === "card"`): the usual cursors at twice
  the size — arrow, a pointing hand over anything clickable, an open hand
  over the draggable card and a closed one while it's held (`.card-grab`,
  `.is-grabbing` while lifted); text boxes keep the text cursor. The hands
  are Lucide's pointer / hand / hand-grab, filled white with the icon's black lines (no outer white edge); the arrow is solid black.
  40px PNGs with 80px Retina copies through `image-set` (`public/cursors`,
  drawn by `frontend/scripts/make-cursors.html` in headless Chrome — the
  command is in the file); SVG cursors blur.
- **An event that needs registering says Register, and asks first.** Any
  event with `requires_signup` shows **Register** in place of Save (feed
  card, event dialog, public page's `EventActions`) until it is saved;
  pressing it opens `member/RegisterConfirm` ("Register for …?" · Cancel |
  Register). Confirming saves it (the card on screen through `flyToDrop`,
  otherwise `attend`) and, when `registration_mode === "external"` with a
  `registration_url`, opens that page in a new tab (`openRegistration`,
  counted as a registration click). Saved, it shows Unsave as usual.
- **Ages and "spots left" are not shown to members** (any surface), nor the
  card's (i) "saving holds your spot" tip (`HoldInfo` is no longer drawn).
  The data and the one-hour holds are untouched.
- **Every save path ends in `flyToDrop`** — drag the card left into the
  sidebar, ← held ~1 s (`useHold`), the Save button, voice "save" and the
  head-tracking left edge. Keyboard mirrors the screen: ↑ previous, ↓ next, ←
  hold saves; head zones are left = save, right = saved list, up/down =
  previous/next (`useHeadTracking`). **A two-finger trackpad swipe (or mouse wheel) over the
  card turns it too** — up for next, down for previous, one card per gesture
  (a non-passive `wheel` listener on `deckRef` in card view: 60px of travel
  turns a card, then nothing counts until 700ms have passed AND the wheel
  has been still for 300ms, so a swipe's momentum — gaps and all — can't
  turn a second card; pinch-zoom and sideways swipes pass by). A new save path should call `flyToDrop`,
  not `attend`, or it skips the animation. A save shows no toast (Jesse's
  call) — the card's button turning to "Unsave event" (which un-saves,
  with the usual Undo toast) and the live region say it; only
  errors and the un-save's Undo toast come from `attend` / `unsave`.
  A save from the card (`attend(ev, true)`) leaves the saved card up for
  0.5 s, then advances, unless the member has already moved on.
  **Dragged toward the saved board (not on a phone), the card turns into a
  mini card**: a `MiniCardFace` ghost (portalled, `ghostT` etc. in
  EventsView) follows the pointer and fades in as the big card fades out,
  fully at the board's edge (`MORPH_DISTANCE`); let go and that mini card
  flies onto the board, or the big card comes back. The sidebar no longer
  tints blue or says "Drag events here" during a drag (no `active` prop).
  While the card travels (drag, ← hold, flight) it is **lifted**: `position:
  fixed` where it sits, `z-index: 50`, with the deck holding its height. The
  feed column is a scroll container, so its overflow clips the card at the
  saved column's edge — no z-index on the card can fix that.
- **Accessibility modes are per-member toggles**, persisted on the user (`Me.tts_enabled`,
  `voice_commands_enabled`, `eye_tracking_enabled`) and loaded from `GET /auth/me`.
  Each is a hook in `lib/`: `useTextToSpeech`, `useSpeechCommands`,
  `useHeadTracking` (head-pose cursor + `CalibrationOverlay`), `useHold`
  (the ← hold). Toggling a mode PATCHes `/users/me` and flips the
  hook — keep the persisted pref and the active hook in sync.
- `lib/feed.ts` orders the feed by match score (interest == `event.category`,
  pref ∈ `accessibility_tags`). **Personalization sorts, it never filters** —
  nothing is hidden. The only things that remove cards are the filter chips in
  `FeedFilters` ("Clear all" at the right end of the chip row once a chip
  is on; an **All** chip first — selected while no chip is, and
  pressing it clears them — then FREE + the topics from `useCategories` — **only the chips some
  upcoming event actually uses** (`chipEvents` in EventsView; Free only if an
  event is free; a chip that's on stays so it can be switched off)),
  which are the member's own explicit choice. There is no sort control.
  Ties fall back to the server's deterministic order, so the feed never
  reshuffles between renders.
- **Saved events stay in the feed, marked saved**: a "Saved" tag (bookmark,
  the accent's soft fill) leads the tag row on the feed card, list cards and
  the event dialog (`EventSummary saved` / `EventTags saved`), and the
  card's button reads "Unsave event".
- **A repeating program reaches the member feed a month ahead**
  (`withinRecurringWindow` in `lib/feed.ts`, applied where EventsView builds
  `feed`, so card, list and Advanced views alike): its next date must start
  within `RECURRING_WINDOW_DAYS` (30). "Repeating" is `series_total > 1` or a
  `recurrence` phrase — every row has a `series_id`, one-offs included, so
  that alone means nothing. One-time events show however far off.
- **"For you this week"** (`recommendedThisWeek` in `lib/feed.ts`): up to six
  programs with `matchScore > 0` starting in the next seven days, one per
  program, for a signed-in member with at least one interest or need. It is a
  section over the list and a "For you" tag on the card — never a change to
  the feed itself. "Not for me" writes the program id (`series_id ?? id`) to
  `Me.dismissed_program_ids` (PATCH replaces the whole list) and only removes
  the row from the section; the toast's Undo writes the list back.
- **"N going" is public** — except on a special-access program, where only
  people approved into its group, its organization and superadmins get the
  count (`_public_view` blanks it for anyone else). `saved_count` is
  otherwise sent to everyone, signed in or not (just a count, no names —
  the shared-list page too), and
  `ui/GoingCount` shows "N people saved this event" (bookmark icon; the
  sidebar shows no count) — at zero too ("0 people saved this event");
  nothing only where the count is withheld. Members and console say it
  the same way; nothing says "going" any more. There is no "See who
  else is going" sign-in nudge any more, and sign-out keeps the counts.
- **One listing, three surfaces.** `member/EventDetails` (no hooks) draws the
  full program — summary, DETAILS, POSTER (`event.poster_url`, opened in a new
  tab: a thumbnail for an image, a file icon and "Poster (PDF)" by extension),
  LINKS (`event.links` plus the organizer's `registration_url`; one
  bordered card per link — label, site name, external-link icon, the whole
  card clickable — two to a row from `sm`) — for the
  "More information" dialog
  (`member/EventDetailModal`, a centred `Modal`; `Modal sheet` and
  `EventDetails stickyActions` remain for a bottom panel, unused now), the public `/events/[id]` page and the print
  preview. Each hands in its own `tools` (`member/EventTools`: Add to Google
  Calendar / Share / Print — ghost buttons in a row under the title and
  its three facts, in the same column beside the picture; through
  `EventSummary`'s `going` slot) and bottom `actions`. `ShareModal`'s Send posts to `POST /share/email` (or, with `organizer`,
  the console's `POST /share/email/organizer`: the same cards under the
  organizer's name, same daily cap — the console's Share opens this same sheet)
  (`routes/share.py`): the site mails the designed cards (logo, photo,
  button) from MAIL_FROM under "{first name} via …", Reply-To the member,
  signed-in members only, 20 a day. A caregiver sharing a member's list
  passes `for_member`, so it is filtered by the member's access. The
  sender's first name is in the From name and subject, which is why
  member names are capped (`schemas/auth.PersonName`, 50). Never a `mailto:` — a mail app only gets
  plain text. No SMTP → a 503 the sheet shows; Copy Link still works. Card
  photos come from `/events/[id]/photo` (stock photos pre-cropped 2:1 in
  `public/placeholders/email/`; re-crop there if you add one). `PrintPreview` is `window.print()`
  over the `.print-target` CSS. The paper is a second copy portalled straight
  under `<body>` (`.print-sheet`, with the logo and title) — printing the
  dialog's own scroll box started the sheet half way down and cut it off
  after one page. Anything that outlives today (paper, shared text, the
  `/shared` page) passes `fixedDates`: "Monday", never "Tomorrow". Nested dialogs work because `Modal` only
  answers Escape/Tab when it is the last `[role=dialog]` in the document, and
  the sheets portal to `document.body` — keep both if you add another.
- **Every event summary shows three facts and no more: when, where and
  the saved count** (`EventSummary`, every layout — feed card, list, dialog,
  event page, print). Cost and registration are the tags beside the title;
  there is no price line, no repeats line, no ages or spots. `EventDetails`
  labels the organizer's link "Sign up on …" when sign-up is needed.
- **Type and colour rules (member app):** tags and filter chips are
  sentence case, never uppercase (18px tags); tooltips 16px; nothing on the
  member side under 16px. One accent (the cyan `primary`), plus a semantic
  set: green Free, blue Paid, neutral grey Registration required. Every
  magnet is the accent cyan. In the event dialog / page, Google Calendar /
  Share / Print are ghost buttons so See on Map (secondary) and Save /
  Register (primary) clearly lead.
- **Tags beside the title: "Free" or "Paid", and "Registration required"**
  (`eventTags` in `ui/Tag`; Free / Paid from the `price` dimension, so it
  always agrees with the FREE filter; the `signup` kind — only when `requires_signup`; a drop-in
  gets no tag; plus Special access and For you where they apply). Drop-in and
  In-person / Virtual are no longer pills on any surface — the facts and
  filters still carry them. `EventSummary` draws title + tags as one
  wrapping row (`heading`), the event page included.
- **Icon sizes in the member app:** facts on the feed card and the event
  dialog / page are 28px beside 20px text (`EventSummary` `icon`; the
  dialog's and page's `GoingCount` pass `size-7`), smaller rows 24px, and
  every button icon 24px (`Button`). All draw a 2px line (see below).
- The fact icons on every event summary (`ui/EventSummary` — feed card, list
  row, saved tile, event page: when, where, ages, spots) and the "going"
  people icon (`ui/GoingCount`) are `text-fg-muted` (#6D6D6D), the card's muted-text grey;
  the words carry the facts. Button icons keep `fg-icon`.
- **The console's "Who it's for" reaches members** (ages and spots no longer
  do — see above; the form no longer asks for ages:
  `min_age` / `max_age` already on an event are carried through unchanged), the Youth answer (no longer asked on the form — `is_youth` already on an
  event is carried through) on the event's own page
  only (`audienceLabel` in `ui/EventSummary`, `detail` layout: "Youth · Ages
  12–18", "For youth" — cards, including the admin card, show just the ages), what it offers (the event page's Accessibility list) and
  special access (the pill).
- **Every member-side icon draws a 2px line, whatever its size** — the
  View toggle's weight. Lucide scales its stroke with the icon (a 48px arrow
  drew 4px), so globals.css draws `svg.lucide` outside `.console` with
  `vector-effect: non-scaling-stroke`. Keep icons at the default
  `strokeWidth` (2) there; the console keeps its own lighter scale.
- `components/SavedEvents.tsx` ("All Saved Events") is one continuous
  scrolling grid — no Back / Next paging. Back + title with Google Calendar /
  Share / Print on the right are one sticky bar with a line under it; search
  with the Upcoming / Past toggle beside it sits just under that, at the top
  of the page, and scrolls away with the list. It has no fetch of its own:
  it is handed the feed's `savedEvents`, so an un-save there and the Undo on
  its toast show at once. Its dialog is named "All saved events" — the
  sidebar already owns "Saved events".
- "Share list" is the design's two rows: Share by Email (the server-sent
  cards above, its button the live list page) and Share by
  Link (the public `/shared/[token]` page, minted when the sheet opens; see
  "Holds, member email, sharing"). A caregiver viewing someone else's list
  gets email only. Jesse's call: no privacy gate, it's only a list. The
  page is `noindex` and server-rendered; `/profile` (from the account menu)
  is where a member sets their email, picture and copies the same link.

### Admin console (`/host/*`)
- `components/AdminShell.tsx` is the chrome: resolves the session and
  `GET /hosts/me`, then renders a slim top bar
  (`components/host/ConsoleHeader.tsx`: the brand, and the account button —
  the person's name over the org's when a staff login is signed in — whose
  menu has Change logo and Sign out) and **a side panel**
  (`components/host/ConsoleNav.tsx`, from `lg`; a scrolling row of the same
  links under the top bar below that, scrolled to the current one): for a
  superadmin, Organization Management first; then Event
  Management (first — every sign-in, reset and invite lands there) with two
  sub tabs indented under it, Analytics and (superadmins only) Topics
  (`/host/topics`) — `children` on the item; below `lg` they join the
  scrolling row as equals — then for superadmins Member Management
  (`/host/users`) with Special Access
  (pending-request badge) as its sub tab, then Team (`/host/team`, every
  organization) last. A sub tab whose parent
  is hidden (Special Access, for an ordinary organization) takes the
  parent's place at the top level. There is no
  in-page switch between those three any more — the side panel is it.
- **Superadmins are added on purpose, never by a checkbox.** The
  organization invite always makes an ordinary agency (`is_admin: false`),
  and inviting is the console's only way to add one — the "Create an
  organization" form (set a temporary password in person) was removed;
  `POST /hosts` remains in the API; "Add a KWHab superadmin" (beside the Organization Admins heading on Organization Management)
  is its own form (what a superadmin can do, a pointer to KWHab's Team page
  for colleagues who should only maintain events — staff are normal
  admins — then an emailed invite with `is_admin: true`). The Organizations table only shows each tier — there is no
  promote / demote button (the API's `PATCH /hosts/{id} {is_admin}` remains). `ConsoleContext` carries `me` (the login) and `org` (the
  organization it acts for): **ownership comparisons read `ctx.org.id`,
  never `session.id`**, which is the person's own login when they're staff.
  The badge count lives there too (`pendingAccess`, `refreshPendingAccess`)
  so a page that decides a request can move it without a reload.
- `/host/team` is the organization's logins: the shared one, each staff
  login, and staff invitations waiting (name + email → `POST /invites` with
  `org_id`; the accept page at `/host/invite/[token]` reads `staff` from the
  preview and creates the login under that org). A superadmin can pick any
  organization. `/host/analytics` is the grant-application numbers: KPI
  tiles, `components/host/WeeklyChart.tsx` (inline SVG, three validated
  categorical hues, crosshair tooltip, a table twin under a `<details>`),
  the per-program table (sortable), a date range (presets + custom; default
  the last 90 days), a superadmin org filter and Download CSV — a plain
  link to `/analytics.csv`, so the browser downloads it with the cookie.
  Console cards and the details page say "N people saved this event · M
  clicks" (`savedLine`, `saved_count`, never "going"; analytics says "Saved
  now") through
  `components/host/ConsoleCounts.tsx` (`EventOut.click_count`, filled only
  for a signed-in organizer).
- `/host/access` is special access: the org's groups (every org's, for a
  superadmin) beside the chosen group's members on Requests / Approved /
  Declined tabs (Declined also lists revoked). Only Revoke confirms; Archive
  surfaces the API's 409 in the modal. `components/host/AccessPicker.tsx` is
  the form's **Special access** box (light grey, a lock, no switch and no
  "Who can see this" heading): a Group picker whose first option, "None —
  everyone can see it", means public, else a group of the *program's*
  organization (`hostId`); **New group** opens a dialog (`NewGroupModal`),
  and **Add members** (beside a chosen group) opens `AddMembersModal`; both
  use `PeopleFields` — for a superadmin a searchable checklist of existing
  members (`GET /users`, which refuses anyone else; then it falls back),
  plus typed email addresses for everyone — the group's name plus people (up to 50,
  added with no approval through `addPeopleToGroup` — in at once with an
  account, invited without), then a summary; the new group is chosen for
  the event — and
  `components/host/PosterField.tsx` / `PosterSection.tsx` are the printable
  poster (`uploadPoster`, PDF or image) and the details page's QR code. The
  QR encodes the program's public page, never the poster file, and is drawn
  client-side with the `qrcode` package (SVG in the page, PNG on download).
  `Tag kind="access" detail={group}` is the "Special access" pill;
  `EventSummary` draws it in the shared tag row, so console cards and member
  surfaces show the same thing.
- Programs are cards, not table rows: `components/host/AdminEventCard.tsx` is
  the component sheet's "Admin – Listed Event" (square image, and beside it
  only the title, `host/PostedBy`, "Posted on Oct 18, 2026" (`created_at`)
  and "N people saved this event" — shown at zero too. No
  date, place, tags, ages or spots: those are on the details page, View
  more. Its icons follow the console's one icon rule (below)
  one square ⋯ button at the top right — over the picture's corner on
  a phone — opening a menu of Edit, Share (the share sheet) and Un-publish
  (red, archive icon — never a trash can: nothing is deleted); Edit and
  Un-publish only for the owner or a superadmin. Escape or a click away
  closes it, and **View more →** at the bottom right, and the **whole card** opens the details page — there is no View
  more button (the title link's `::after` covers the card; the tools sit
  above it on `z-10`), with a hover state — darker edge, faint fill, soft shadow).
  `/host/events` is centred, 1200px of content at most, wide margins. `ui/Tooltip` shows on
  hover and keyboard focus, is the control's `aria-describedby`, and closes
  on Escape — use it rather than `title` for icon-only buttons beside `components/host/PostedEvents.tsx`'s accordion
  `FilterPanel` (console-only groups first — Status, Your Events only, since
  All Events lists published events alone; Date posted, cumulative "Past 7
  / 30 / 90 days" or older; Posted by, the person or the organization —
  then the feed's dimensions) (`ui/Checkbox` rows; its reset row reads "No filters" so it
  isn't confused with the toggle), with a Your Events / All Events toggle. The panel is sticky under the
  console header (`lg:top-[97px]`, scrolling itself if taller than the window).
  **A filter matches every option a program is in** (`Dimension.all`,
  `bucketsOf` in `lib/dimensions.ts`): each of its topics under Activity
  Type, and both Virtual/In person and Youth under Event Type, because the
  form asks venue and audience separately. `bucket` (one per program) is
  still what the member stepper and tags group on. The console says
  "event" throughout, never "program" (the printed poster, which members
  read, keeps the member app's word).
  Edit and un-publish show only for the owning organization or a superadmin;
  share and print for everyone. Un-publishing from the list or the details
  page goes through `components/host/UnpublishModal.tsx` — the pink-edged
  confirm plus `unpublishedToast` (title, "was successfully un-published",
  Undo → `restoreEvent`); the list patches its rows in place rather than
  refetching the calendar. There is no generated poster any more (the
  card's poster tool, "Print poster" and `PosterSheet` were removed); the
  agency's own uploaded poster and its QR code (`PosterSection`) remain.
  `/host/events/[id]` is a read-only details page that **mirrors the event
  form**: the same 5fr / 7fr columns, left column fields, right-column
  `Group`s (EventForm exports `Group`; its `.group-heading` is 20px on both
  pages), headings and field labels (14px, answers 14px too — on the
  details page the labels are medium weight and the answers regular, since
  no box sets the answer apart), and every
  field the form has — an empty one reads "None", "No limit", "Any" or
  "Everyone" rather than disappearing (`ReadField`, `IconList`). The
  organization is the header's subtitle — "Posted by …" here, "Posting
  under …" on create (`PageHeader subtitle`); the header's buttons share the
  title's row and don't wrap from `lg`. Header: Share (icon) / Print (icon) / Edit / Un-publish (just the word);
  the link reads "Sign-up link" or, for a drop-in, "External links" ("(optional)" on the form). **There is no Un-published tab any more**: Your Events lists the
  organization's un-published events after its published ones (from
  `GET /events/archived`, filtered to the org), every card tagged
  Published / Un-published (`EventStatus`), an un-published card's ⋯ menu
  offering Restore. **An un-published
  program opens there too**, for its organization or a superadmin, from
  "View more" on the Un-published tab: `GET /events/archived/{id}` (same
  rule as the list; the public `GET /events/{id}` still 404s), shown with a
  notice and **Restore** in place of Edit / Un-publish, and without Copy
  link, the poster or its QR code (its public page is gone). Its back arrow
  returns to `/host/events?scope=unpublished`, which now lands on Your Events. `/host/events/[id]/edit`
  shares `EventForm` with create.
  **The event's name is the page title** on every event page (28px,
  `.event-title`; the header's buttons on the title's row at the right,
  top-aligned). Under the title, `host/PostedBy` says who posted it and from where,
  with their picture: "Posted by Sam Lee · Karis Disability Services" for a
  staff login (initials avatar — organizer logins have no photo), just the
  organization with its logo for the shared login or an imported event —
  then "· Published on Oct 18, 2026" (`showPublished`, from `created_at`). Under that, still in the header, the
  saved count (`ConsoleCounts`: "N people saved this event · M clicks").
  `EventOut.created_by_name` / `created_by_picture` are filled for signed-in
  organizers only (one query per page in `_public_view`); members never
  see who on a team posted what. Beside the title a status tag (`host/EventStatus`, on
  `AdminTable`'s `Pill`) says where the event stands: **Draft** on create
  (nothing is saved until Publish — there is no server-side draft state),
  **Published** on edit and on a live event's details, **Un-published** on
  an archived one's. On the details page Share and Print are icon-only buttons
  with `ui/Tooltip`s, then "Edit" (pencil + word) and Un-publish. In the form it is typed right there: `EventForm`
  draws its own header (the page passes `header` — back link, subtitle,
  buttons), whose title is the name input (reads as a heading, shows it's
  editable on hover / focus, carries the required error); the form has no
  separate name box. The details page's title is `event.title`.
  **Layout (after a Sweatpals reference): no boxes, picture on the right.**
  From `lg` the create / edit form and the details page are two equal
  columns: every field on the left in `Group` sections (Description
  first, then Event details (date, time, where — the venue toggle beside its
  address / meeting link — cost and how people join, the paid details,
  who can see this, repeats), Event tags (topics, what it offers). No
  Who it's for section; the capacity is the optional "Attendee limit"
  under How people join) — a rule above each), the
  event picture on the right, 520px tall and `sticky` so it stays in view
  (`ImageDrop frameClassName`). One column below `lg`, the picture first.
  The buttons are top right in the header: Cancel (through the leave
  guard), Un-publish on edit (`UnpublishModal`, then back to the list with
  the Undo toast), and the primary Publish / Save at the far right.
  **`EventForm` is one page in two columns** (from `lg`; one column, same
  order, below): on the left, under an "Event details" heading (same size as
  the right column's group headings — on the details page too), the event
  image, date and time, where (the Virtual / In-Person toggle and its box
  on one row: "Address", required, or "Meeting link", optional — both are
  `events.location`; `lib/place.ts` shows a link as "Online" on every card
  and as "Join online" on the event page), and repeats; on the right `Group`s for Description, Cost & sign-up and Who
  it's for. **Topics and "What does it offer?" are the Event tags section** (topic
  chips, required — "Pick at least one topic."; then the access-need
  chips); Publish / Save submits straight away, no dialog. **There is no Details & links group** — the form has
  no Extra details or Printable poster field any more (an event that already
  has notes or a poster keeps them, and members still see them; the form
  carries them through unchanged). Cost has its own row — Free / Paid only, a label (Paid saves
  `pricing_model: custom`, note "Paid"; an event that already carries a
  structured price keeps it, hidden) — with a note beside it that the
  platform doesn't process payments and the cost is for display only. There
  are no "How is it paid?" options any more, then **How people
  join** on its own row with the **Sign-up link** beside it once Registration
  is chosen (a drop-in that already has a link shows it as Posting link),
  then, for Registration only (switching to Drop-in clears it), an
  optional **Attendee limit** — a switch (`limitOn`; off clears
  it) that reveals the number when on (`capacity` — drives the
  one-hour holds; members aren't shown spots); Repeats sits beside the
  Date on the same row (create only; Date alone when editing). The details page mirrors all of this.
  After How people join (and the attendee limit), still under Event
  details, are **External links (optional)** — `links` rows of label + address,
  the first always shown with a + button beside it (tooltip "Add a link")
  that adds a row, up to `LINKS_MAX` (3); later rows have ×, and once all
  three are showing the first row gets an × in place of the + too. The details
  page reads them back as "External links". **The console calls the topic list
  "Topics"** (form, filter, details page) — what the design called Activity
  Type. `events.activity_type` is something else: an unused "kind of event"
  (`lib/activities.ts`: Class, Workshop, …) with no UI, empty on every live
  program; the form only carries it through unchanged. (It was a six-step flow; the
  steps, the Review step and `FIELD_STEP` are gone.) Publish / Save is in the
  page header and at the bottom, for create and edit alike; submitting with something missing shows "Still needed: …" at the
  top (scrolled to) and each field's own message. The form carries
  `.form-dense` (`globals.css`): 14px text and 36px controls inside it only,
  so the shared TextField / Button / FilterChip keep the member app's large
  sizes. `useLeaveGuard` asks "Leave without saving?" for any link that
  leaves a changed form — the back arrow, the side panel, the logo, the
  account menu (a capture-phase click listener, since client-side navigation
  never fires `beforeunload`) — plus the browser's own warning on reload.
  Accounts stay table-first — `components/AdminTable.tsx` backs
  `/host/admins` (Organizations) and `/host/users` (Community Members). `/host/events`' search box
  fills the row beside its buttons (one row from `md`; `SearchField`'s grey
  is a half-strength `surface-subtle`). `AdminTable` also holds the
  console's field primitives (`Field`, `Select`, `TextArea`, `SearchField`,
  `controlClass`, `RequiredMark`) so a `<select>` or `<textarea>` gets the
  same box as `ui/TextField`; don't restyle a control inline.
- **One icon for the whole console:** every Lucide icon is 16px with a
  1.5px line (`globals.css`, non-scaling stroke) — buttons, side panel,
  menus, fields, cards, tags, counts. Large illustrations (`size-8` /
  `size-12`) keep their size, same line; `.icon-exempt` opts out (the
  checkbox tick). Don't size console icons one by one.
- **One smaller type and control scale for the whole console.** `AdminShell`
  puts `.console` on every console page, and `globals.css` maps the shared
  components' member-app sizes onto it: 12px small, 14px body (and tables),
  16px card/section titles and page leads, 20/24px headings, 30/36px page
  titles (`h1`), 36px controls; printouts
  (`.print-target`) are exempt. Write console markup with the normal
  Tailwind classes — the remap does the rest — and check a new page with
  the sizes in mind rather than adding one-off overrides. The member app
  has no `.console`, so its large accessible sizes are untouched.
- **Console form fields** (`globals.css`, under `.console`): every field is
  `.field` (TextField, AdminTable's `Field`, the event form's `Section`) with
  a `.field-label` — regular weight, `#4d4d4d`, lighter than answers and
  darker than placeholders. Spacing is one rule: 6px label→control, 16px
  field→field (any container holding fields), 12px inside a fieldset —
  except the event form, whose sections (`.event-group`) space their
  inputs and components 24px apart. A
  field's leading icon (`.field-icon`: date, time, place) is 16px, thin and
  grey, 10px from the edge; date and time boxes hide the browser's picker
  button and open the picker on click (`TextField`). The event screens' information icons (a
  card's or the details page's date / time / place, the going and clicks
  counts, the filter groups) carry `.info-icon` and get the same look, 8px
  from their text; icons on buttons are actions and keep their size. In the event form the
  picture sits in a 300px-tall, full-width frame, cropped to fill
  (`ImageDrop square`); with no picture it is a plain grey 300px box with one "Upload image" button (drop still works).
  Editing passes `imageFallback={eventImage(event)}`, so an event without a
  cover of its own shows the picture members see (another of its images or
  the topic's stock photo). A picture in the form has one control: a dark,
  see-through **Replace image** button in its middle (dropping a file on it
  works too) — no Change / Remove under it. The create and edit pages have
  wider margins than other console pages and are centred (1200px content);
  the details page too. There is no
  "* Required" key over the form — the asterisks on the fields say it. The
  right column's dividers
  are `border-line/40`.
- Dense and staff-first — **deliberately not** the soft one-thing-at-a-time
  member idiom. Staff doing repetitive work want everything one click away;
  don't "harmonize" the two surfaces just because the sidebar went.
- Superadmin-only pages pass `requireSuperadmin` to `AdminShell`, which gates the
  page itself, not just the nav entry. The API refuses regardless.

### Shared
- **Every corner is 8px.** `tailwind.config.ts` resolves `rounded`,
  `rounded-sm` … `rounded-3xl` and the named `control` / `field` / `card`
  radii all to 8px, and the branded emails (`core/mail.py`) match.
  `rounded-full` stays round (avatars, the round tool buttons, badges,
  pills; the event cards' tool buttons are square now); the browser-tab icon keeps its own shape.
- **One back control everywhere: `ui/BackButton`** — an arrow and its
  words ("← Back to events", "← Back"), a link or a button, on its own line
  **above** the title (`TitleWithBack`, or `PageHeader`'s `backHref`).
  Console pages, the All Saved Events panel, Profile, both forgot-password
  pages (`AuthPage` / `MemberAuthPage` take `back`) and every sign-up /
  log-in step on the `/signup` page (`AuthView.back`). **In a modal, back
  is a secondary button beside the primary one** (Back | Next, Cancel |
  Login, Go back | Continue — `FormFooter`): the in-feed sign-in sheet passes
  `backPlacement="footer"` to `MemberAuthFlow`, which then puts each step's
  back in its footer instead of `view.back`. No corner back links. (The
  tour's Back is a slideshow control, not navigation.)
- All HTTP goes through the single `api()` helper in `lib/api.ts`
  (`credentials: "include"` for the auth cookie). Image uploads use raw `FormData`
  via `uploadImage()` — never force `Content-Type: application/json` on those.
  Render errors with `apiMessage(err, fallback)`; `ApiError.message` is the raw
  body, so printing it directly shows people `{"detail": …}`.

## Gotchas / conventions
- **Passwords use `bcrypt` directly — do NOT reintroduce `passlib`** (crashes on
  bcrypt ≥4.1). Hashes are standard `$2b$`.
- **Icon keys were retired 2026-09-28.** Members sign in with email +
  password only (`POST /auth/signup/user`, `POST /auth/login/user`); the old
  `POST /auth/user` door is gone. The `users.icons` column remains because it
  is NOT NULL and half of `uq_users_username_icons`: `auth.new_member` still
  allocates a hidden set per username (`core/icons.random_icon_set`), and a
  rename re-allocates one. It is never returned by the API. Rows with
  `auth_type = 'icon'` predate the change and can't sign in until a superadmin
  sets them a password (or they reset one by email, if they had added one).
  The Postgres-backed rate limiting in `app/core/rate_limit.py` still guards
  every sign-in, sign-up, forgot, reset and care-link route.
- **Sessions are bound to the credential that opened them.** Tokens carry `cv`,
  a fingerprint of the password hash (`security.credential_fingerprint`), and
  `deps` re-checks it on every request. So a password reset, or a superadmin
  setting a member a temporary password, ends the sessions opened with the old
  one instead of leaving them live for the week a token lasts. Every place that
  mints a token must pass `cred_hash`, and `/auth/me` must apply the same check
  as the API — otherwise the UI shows a signed-in app where nothing works.
- `JWT_SECRET` has no default — the app fails fast if it's unset.
- DB engine uses `NullPool` + `prepare_threshold=None` for pgbouncer compatibility.
- **Nothing is deleted; things are archived.** Events, members *and organizer
  accounts* carry `deleted_at`, un-saving flips `event_attendees.status` to `removed` rather than
  dropping the row, and the `attendees` relationships deliberately have no
  `delete-orphan` cascade. Attendance counts are what nonprofits put in grant
  applications, so they have to outlive the event and the account. Every read
  path filters `deleted_at IS NULL`; add the filter when you add a query.
- **Saving is a bookmark.** It never registers anyone, and it never fails for
  capacity. What `events.capacity` does is hold a spot for the first hour —
  see "Holds, member email, sharing" below. `EventOut.saved_count` ("N going")
  is public — shown to signed-out visitors too.
- **Member emails are unique over live rows only** (`uq_users_email_live` on
  `lower(email)`), the same rule as `uq_hosts_email_live`.
- **Special access is per group, not per event.** `access_groups` belong to
  one organization; `events.access_group_id` (null = public) restricts a
  program to members whose `access_memberships` row is `approved`. The rule
  lives in `app/core/access.py`: lists (`GET /events`, the saved list) are
  scoped — anonymous sees public, a member adds their approved groups, an
  organizer adds their own org's restricted programs, a superadmin sees all —
  but **every by-id route serves a restricted program to anyone**, so a link
  or QR code opens and the page can offer "request access". Saving is what
  needs approval (403 otherwise). Memberships are never deleted, they move
  between `requested | approved | declined | revoked`; a declined/revoked
  member re-requesting gets 409 and only the console can let them back in.
  Groups archive (`deleted_at`) and refuse to while live programs use them.
  **Organizations can also add people by email, with no approval step**
  (`POST /access-groups/{id}/people {emails}`, up to 50; `core/access_invites.py`):
  an address with a live member account is approved at once (whatever its
  earlier status); one without gets an `access_invites` row (migration
  `0028`) and is approved the moment an account is made with that email —
  `auth.new_member` calls `apply_pending`, so every way of creating a member
  picks it up. Both are emailed. `GET …/invites` lists the ones waiting to
  sign up, `DELETE …/invites/{id}` withdraws one (`revoked_at`). Console:
  "Add people" on a group, and a "Waiting to sign up" list under it.
  Member side: `ui/Tag kind="access"` (lock + group name) is drawn by
  `EventSummary`, so every surface carries it; `member/AccessAction` is the
  one control that stands in for Save until `access_status` is `approved`
  (`none` → Request access, `requested` → disabled "Request sent",
  `declined`/`revoked` → "Access not approved"). The public `/events/[id]`
  page is rendered without the viewer's cookie, so `EventActions` re-reads
  the event in the browser to learn their standing, and a signed-out request
  resumes through `/signup?next=…?access=1` the way `?save=1` does. Those
  pages set `robots: noindex`.
- **`lib/accessibility.ts` is the same idea for access needs.** The slugs sit on
  both `events.accessibility_tags` and `users.accessibility_prefs`, and matching
  is string equality, so one list drives the host picker and the member picker.
  Unknown slugs still match and still render (`tagLabel` prettifies them), so a
  tag added straight to the database is not lost — the vocabulary is expected to
  grow. `free` and `no_registration` are marked `derived`: they are written from
  the cost and drop-in answers rather than offered as chips, because asking twice
  is how the two answers end up disagreeing.
- **Topics live in the `categories` table (`slug` pk, `label`, `sort_order`,
  `deleted_at`), and the slug is the identity.** `events.categories` (with
  `events.category` mirroring its first entry), `users.interest_categories`
  and interest matching (`lib/feed.ts`, `FeedFilters`) all hold and compare
  **slugs**; the label is display-only. Superadmins rename, reorder, add and
  archive topics on `/host/topics` (`GET /categories` is public; the rest is
  `require_admin`) — a rename changes what's printed and nothing about who
  matches, and archiving a topic that live programs use requires
  `reassign_to`, moving those programs *and* members' interests in the same
  transaction. A slug is minted once (`core/categories.slugify`, suffixed if
  taken) and never reused, even after archiving. Every write of a topic —
  event create/update, member sign-up, `PATCH /users/me` — goes through
  `require_live_slugs`, so a value typed by hand can never reach the database.
  On the frontend `lib/categories.ts` fetches the list once per page load
  (`useCategories()` for chips and pickers, `categoryLabel(slug)` for plain
  functions like `lib/dimensions.ts`); icon/colour per slug stay in that
  file, so a new topic gets a stable hashed colour and the fallback icon.
- **No emoji anywhere — every picture is a Lucide icon** (the app's one icon
  set). Topics (`categoryStyle(slug).icon`), access needs
  (`ACCESSIBILITY_TAGS[].icon`, `tagIcon`), profile emblems (`emblemIcon`) and
  the unused activity kinds hold a `LucideIcon`, drawn through `ui/Glyph`,
  which sizes it to the surrounding text (1em) — so the same chip works at
  14px in the console and 30px on the sign-up tiles. Lucide has no butterfly:
  the `butterfly` emblem (slug unchanged, it's stored) is a flower, labelled
  "Flower". Check a new icon exists in the installed lucide-react before
  using it. Migration
  `0022_categories` rewrote the stored labels to slugs (ignoring case and stray spaces) and
  keeps anything it doesn't recognise as-is (the archived demo programming's
  `Advice`/`Arts`/`Hangout`/`Food`) — don't add a free-text category input,
  and don't start a second list.
- The persisted field is `eye_tracking_enabled` but the hook is
  **`useHeadTracking`** (head pose, not gaze — webgazer was replaced). The column
  name is legacy; don't rename it expecting the hook to follow.

## Organization pages (`/o/{slug}`)
- **Every organization has its own page**: the member feed holding only its
  programs (`frontend/app/o/[slug]/page.tsx` → `EventsView space={…}`, which
  names the organization over the heading and passes `space.slug` to every
  `fetchAllEvents`). `GET /events?org={slug}` filters to that organization
  (`[]` for an unknown slug); `GET /hosts/spaces/{slug}` (public) is its name
  and logo, 404 if none. `hosts.slug` is minted once from the name
  (`core/org_space.unique_slug`, migration `0029_org_spaces`), organizations
  only — a staff login has none.
- **`hosts.in_shared_feed`** decides whether its programs also reach the
  shared feed at `/` — the unfiltered `GET /events` drops organizations with
  it false. New organizations start in the shared feed, and **the console
  has no control for it any more** (the onboarding choice and the
  Organizations table's "Their page" column were both taken out) — it is set
  through the API: `PATCH /hosts/{id} {in_shared_feed}`, or `in_shared_feed`
  on `POST /hosts` / `POST /invites` (`host_invites.in_shared_feed`). "Own page only" is how an agency tries the
  platform without the other agencies' programs. By-id routes are untouched,
  so a program's own link opens either way. The console's account menu links
  to the organization's page.

## Importing a calendar (`/host/import`, superadmins)
- **Bring an organization's existing calendar in as events** — KW Hab's
  Teamup community calendar (`https://ics.teamup.com/feed/ksakacjdxmrwoqtzym/0.ics`),
  or any iCal feed / `.ics` file (Google, Outlook). "Import events" on Event
  Management (superadmins only).
- **Preview, then commit — nothing is written until Import.**
  `POST /imports/calendar/preview {url | ics}` reads it
  (`core/calendar_import.py`: `fetch` — http(s), public addresses only, ≤ 5 MB;
  `parse` — pure, upcoming dates only, ≤ 104 dates and two years per program,
  using the calendar's own dates so skipped (EXDATE) and moved
  (RECURRENCE-ID) ones come through) and answers one row per program with
  its matched organization (`match_org`: exact, contained, or initials —
  "WRFN"), guessed topics (`guess_topics`, keywords → live slugs), a
  `restricted` flag (an audience "who registered" elsewhere, e.g. LEG Up!)
  and a likely duplicate (same organization, similar title, same day). The
  page maps each calendar organization once and each restricted audience
  once ("Audiences": "People who registered through LEG Up!" → a group of
  that organization — fills every matching row), then lets the superadmin
  untick rows and set each one's topic and special-access group. Preview
  re-reads the groups, so one made meanwhile is offered.
  `POST /imports/calendar/commit` creates them all-or-nothing: one row per
  date sharing a series_id, like a console repeating event; free unless the
  calendar tags it paid; drop-in; "Who: …" and any overflow of a long
  description under extra details; link lines as Important Links.
- Teamup's categories mix organizations with flags — "Free Community
  Events", "Paid Community Events", "Virtual Events" — which set cost and
  venue instead. Titles' trailing "(audience)" is dropped when it repeats
  the Who.
- New dependencies: `icalendar`, `python-dateutil` (requirements.txt). No
  migration.

## Holds, member email, sharing
- **Saving a program with a `capacity` holds a spot for one hour**
  (`event_attendees.held_until`, `core/holds.py`). Capacity never refuses a
  save: if the holds still running are under capacity the save gets one, else
  it is saved without. Un-saving clears it; re-saving after expiry can take a
  fresh one. `take_hold` locks the event row so two members can't both get the
  last spot. `EventOut.spots_left` = capacity − active holds (null without a
  capacity) and `held_until` is the viewer's own hold; both come from
  `holds.annotate` over the eager-loaded attendees, never off the row.
- **A member's email is their login** (`PATCH /users/me {email}` can change
  but not clear it). Unique over live rows, lowercased. It is also the channel
  for the day-before reminder (`GET /internal/reminders`, cron,
  `reminded_at` makes it once) and the change notice `update_event` sends when
  `starts_at`/`ends_at`/`location` move (`core/member_mail.py`, background).
- **Profile pictures** are a photo (`POST /users/me/avatar`, ≤ 2 MB, sniffed,
  same bucket as event images) or an emblem from `core/avatars.EMBLEMS`. One
  clears the other.
- **Shareable saved list**: `POST /users/me/share-link` mints `users.share_token`
  once; `GET /shared/{token}` is public and lists the member's upcoming saved
  *public* programs — special-access ones are excluded whoever holds the link.
- **Google Calendar: connected when configured, subscribed otherwise.** Both
  "Google Calendar" buttons (sidebar and All Saved Events) and the profile's
  card go through `lib/calendar.googleCalendarButton(Me.google_calendar)`:
  - `available` / `connected` (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET set):
    `GET /google-calendar/connect` → Google consent (scope
    `calendar.app.created` only — the app's own calendars, nothing else in the
    account) → `/google-calendar/callback`, which checks the signed `state`
    against the signed-in member, stores the refresh token Fernet-encrypted
    (key derived from JWT_SECRET) with the calendar it created ("The
    Belonging Collective"; migration `0025_google_calendar`) and lands on
    `/?calendar=connected|cancelled|failed` for the toast. `core/gcal.sync_member`
    then makes that calendar match `saved_events()` — insert / update /
    delete, only events carrying our `tbcEventId` mark — after every save and
    un-save (`gcal.after_save`, caregiver routes included: the row is the
    member's), after an organizer's edit / archive / restore
    (`sync_event_savers`), and daily from the reminders cron
    (`sync_everyone`). Event ids are `tbc` + the UUID hex, so a re-save
    restores the same event (Google's 409 on a cancelled id → PUT confirmed).
    Google failures are logged, never fail a save; a revoked grant
    disconnects quietly. `DELETE /users/me/google-calendar` deletes the
    calendar and revokes. Calendar scopes are sensitive: until Google verifies
    the app it runs in Testing mode — listed test users only, and their
    grants lapse after 7 days (sync then disconnects and the button offers
    Connect again). **Reconnecting reuses the calendar, never adds a second
    one:** `google_calendar_id` is kept after a revoke or a delete that
    failed (only the refresh token decides "connected"), because our scope
    can't list calendars — that id is the only way back to it. While
    connected, the subscription feed below serves no events, so a feed the
    member subscribed to earlier doesn't show every program twice.
  - `off` (unconfigured): subscribe-by-URL. `POST /users/me/calendar-feed`
    mints `users.calendar_token` once (migration `0024_calendar_feed`) and the
    tab goes to Google's subscribe page for `webcal://…/calendar/{token}.ics`
    — the same `saved_events()` list, followed on Google's own refresh
    (hours). Deliberately not the share token, which is public. A second
    press must not list it twice: the feed stamps `calendar_feed_fetched_at`
    when fetched (migration `0026`), and while that is under three days old
    the POST says `subscribed`, so the button opens Google Calendar with an
    "Add it again" toast instead of Google's Add page.
  A caregiver viewing someone else's list gets that member's `.ics` download
  either way. Single programs use Google's prefilled "add event" link.

## Caregivers and care links (support, not proxy)
- A **caregiver** is a password member account with `users.is_caregiver`
  (set at sign-up via `is_caregiver` on `POST /auth/signup/user`; the profile
  no longer has a toggle, it only lists "People I support" for an account that
  already is one). **The member keeps their own account and their own
  credential**; a caregiver never signs in as them. `care_links(caregiver_id,
  member_id, created_at, removed_at)` (migration `0021_caregivers`,
  `models/care.py`) is the only user-to-user relation. Unlinking sets
  `removed_at` from either side (`DELETE /users/me/care/{member_id}` or
  `DELETE /users/me/caregivers/{caregiver_id}`); re-linking clears it. Never
  delete the row.
- **Linking is the member's consent.** `POST /users/me/care/links` takes the
  member's *own* email + password (`auth.member_by_credential`), and
  `POST /users/me/care/members` creates the member's account on the spot
  (name, email, password) through the same `auth.new_member` every door uses.
  Both are rate-limited like sign-in, on the same identity keys
  (`auth.credential_identity`), so guessing a member's password here costs
  what guessing it at the door does.
- **The member can start it too: caregiver invitations** (`care_invites`,
  migration `0027`). **Community members only** — a caregiver account gets
  a 403, and its profile shows "People who support me" only if people were
  linked to it before it became a caregiver (Remove / Withdraw, no Invite).
  Profile → "People who support me" → Invite a caregiver: `POST /users/me/caregivers/invites {email}`
  mails `/care/invite/{token}` and returns the link once (token stored as a
  hash, 14 days, re-inviting an address replaces its waiting invite).
  `GET /care-invites/{token}` previews it ("Sam R." + the invited email);
  `POST /care-invites/{token}/accept` links the signed-in account **only if
  its email is the invited one**, and turns it into a caregiver account.
  The member withdraws an unanswered invite with
  `DELETE /users/me/caregivers/invites/{id}` (`revoked_at`, never deleted).
  Ending a link is the same two routes as above, whichever door made it.
- **Duplicate-account nudge** (`lib/knownDevice.ts`): a successful member
  sign-in or sign-up stores a masked hint (`j•••@gmail.com`) in
  `localStorage` (`tbc.known_account`); the sign-up flow's account-type step
  then offers "Log in instead" / "Forgot your password?" first. Browser-only,
  never the full address.
- **Saving for a member is the member's row.** `routes/care.py` calls the
  same `attendance.save_event` / `unsave_event` the member's own routes use,
  with the member as the user — so the hold is the member's spot and special
  access is the member's approval (403 if they aren't approved, whatever the
  caregiver's standing). Every care route goes through `_member_for`, which
  403s without an active link to a live member.
- `UserOut` / `GET /users/me` carry `is_caregiver`, `care` (the members this
  account supports) and `caregivers` (first name + last initial only — the
  member sees who can save for them, not the caregiver's full name or
  email). `/auth/me` echoes the same three. `GET /users` (console) eager-loads
  the links; add `selectinload` to any new list that returns `UserOut`.
- **Reminders ride along**: `member_mail.send_reminders` mails each linked
  caregiver with an email one message per run, grouped by member, for the
  members' programs starting tomorrow. It uses the member's `reminded_at`
  stamp — the caregiver copy goes out after the stamps commit, so a run that
  dies loses today's copy rather than sending anyone's twice. Members without
  an email now appear in the query (their caregiver may have one); their rows
  are stamped like everyone else's.
- Frontend: the "Saving for: Me ▾ / Sam R." switcher in `FeedHeader`
  (`CareSwitcher`, only for a caregiver with links) sets `careFor` in
  `EventsView`; `attend`, `unsave` and `syncSaved` read it through a ref, so
  **every save path still ends in `flyToDrop` → `attend`** and saves for whoever
  is selected. The sidebar, "All Saved Events" and the `.ics` show that
  member's list (`owner` / `calendarUrl` props); "Link to my list" is hidden
  there because the share link is the signed-in account's own. Default is
  "Me", reset on sign-in/out. `member/CareLinkForm` (create: name + email +
  password; link: email + password) is shared by the sign-up flow's "I'm a
  caregiver" path and `/profile` ("People I support" / "People who support
  me").

## Roles and admin tiers
- **members** — email + password (`POST /auth/signup/user`,
  `POST /auth/login/user`; `components/member/MemberAuthFlow.tsx` is the
  chooser → sign-up / log-in flow, wrapped by `LoginOverlay` in the feed and by
  `/signup`), the `/` + `/events` experience. A member may also be a caregiver
  — see above.
- **admins** — hosts with `is_admin = false`. Create and manage only their own
  programs.
- **superadmins** — hosts with `is_admin = true`. Manage any program, plus member
  accounts and other admin accounts. `require_admin` in `app/api/deps.py` gates
  these, and it reads the tier from the DB, not the token.

**Organizations and staff logins share the `hosts` table.** An agency's own
row (`org_id` null) is its shared login and the owner of everything —
`events.host_id`, `access_groups.host_id`, invitations. A **staff login**
(`org_id` set) is one person at that agency with their own name, email and
password; the agency can keep the shared login, add staff logins, or both.
Everything a staff login does is done *as the organization*:
- `org_id_of(host)` in `app/models/host.py` (`host.org_id or host.id`) is
  what **every ownership check** compares against — events create / edit /
  archive / restore, `core/access.py` scoping, access groups, invites,
  analytics. Programs keep `host_id` = the organization;
  `events.created_by_host_id` records which login posted it (attribution,
  not ownership).
- **A staff login is never a superadmin** — not even at KW Habilitation:
  `Host.is_superadmin` is the organization row's `is_admin` and always false
  for a staff row, so someone added to KWHab's Team maintains KWHab's events
  like any agency's staff (no Organization / Member Management, Topics or
  Import). Superadmins are added on purpose ("Add a KWHab superadmin").
  `deps.load_live_host` loads the org alongside the login (and treats a
  login whose org is archived as archived). Use `is_superadmin`, not the
  `is_admin` column, when deciding what a caller may do.
- Staff join by **invitation**: `POST /invites` with `org_id` + `name` (any
  login of that org may send one, a superadmin for any org; the mail and the
  accept flow are the same as an organization invite), `GET /hosts/team`
  lists the org's logins and pending staff invites, `DELETE /hosts/team/{id}`
  archives one staff login. `GET /hosts` (superadmin) nests `staff` under
  each organization. Staff reset passwords by email like any organizer.

**There is no host signup route.** It existed and was open to the internet;
superadmins now create organizer accounts via `POST /hosts` or by issuing an
invitation (`/invites`), and `/host` is sign-in only. Don't add one back.

## Analytics
`GET /analytics?from=&to=&host_id=` (and `/analytics.csv`, same params) are
the adoption numbers agencies put in grant applications: totals (saves,
unique members who saved, registration-link clicks, programs posted), a
weekly series of the same, and a per-program table (title, first date, org,
saves, currently going, clicks). A plain organizer gets their own org
whatever `host_id` says; a superadmin passes `host_id` or omits it for all.
Weeks are Monday-start in America/Toronto; the default range is the last 90
days. Two counting rules, both deliberate: **saves count every attendance
row created in the range, `removed` ones included** — a save that happened
still happened, and un-saving only flips the status; and **nothing filters
on `deleted_at`** — a program un-published since still counts for what
happened while it was up, and the table marks it `archived`. A repeating
program is one posting (`coalesce(series_id, id)`). Everything is
aggregated in SQL in `app/api/routes/analytics.py`; keep it that way.

**One event's numbers** are the Analytics tab on its details page
(`/host/events/{id}?tab=analytics`, `host/EventAnalyticsPanel`), from
`GET /events/{id}/analytics`: all time since it was posted, the whole
series — going, saves, unique savers, clicks, saves and clicks per week
(`WeeklyChart keys`), and a By date table for a repeating event. Same
counting rules. Its organization and superadmins only (403 otherwise), so
the tabs only show for them; an un-published event answers too.

## Account recovery
Both doors reset by email, the same way: a single-use token stored as a
SHA-256 hash, expiring in an hour, issued (row + mail) on a background task so
the response time doesn't say whether the address exists. `forgot` answers
identically whether or not the address has an account — keep it that way,
including on the error paths. Rate-limited per address (5) and per IP (20).
- **Members**: `/auth/forgot` → `/auth/reset` (`member_password_resets`,
  migration `0023`), pages `/forgot` and `/reset/[token]`, linked from the
  log-in step as "Forgot your password?". The other way in is a superadmin on
  `/host/users` using **Set password** (`POST /users/{id}/set-password` with
  the email): a temporary password is generated and shown once to read out,
  the old credential and its sessions end. That is also how a legacy
  `auth_type = 'icon'` account (flagged "No password yet") gets in. Adding a
  member from the console (`POST /users`, name + email) works the same way.
- **Organizers**: `/auth/host/forgot` → `/auth/host/reset`. This exists
  because the sole superadmin previously had no way back in at all.

Two invariants worth knowing before touching `app/api/routes/hosts.py`:
- **Removing an admin archives the account, its programs and its staff
  logins.** `Host.events` cascades `delete-orphan`, so a plain
  `db.delete(host)` would destroy programs members have already saved. It
  used to reassign them to the acting superadmin instead, which kept them
  visible but filed one agency's work under another's name — so both now get
  `deleted_at` and the programs stay attributed to the organization that ran
  them; the org's staff logins are archived in the same statement, since a
  person can't act for an agency that has left. Removing a staff login
  (`DELETE /hosts/team/{id}`) archives just that row. `hosts.email` is unique
  over live rows only (`uq_hosts_email_live`), so an archived account
  releases its address and an agency that left can be invited back under it.
- **A superadmin can't demote or delete themselves — or their own
  organization.** The guards compare the target against both `current.id` and
  `org_id_of(current)`, so a staff login of a superadmin org can't archive or
  demote the org it signs in through. That refusal is what keeps at least one
  superadmin in the system — you can only remove someone else's rights, so
  your own survive. `_superadmin_count` counts organizations only.

## Status
**https://the-belonging-collective.vercel.app is live and public.** Both of the blockers this
section used to list are fixed, and the fixes were dashboard settings, so
nothing in the repo records them — verify against the deployment, not the code:

- SSO protection is scoped to **preview** deployments only, so production is
  reachable without a Vercel login. Preview URLs still 302 to the login wall;
  that is deliberate, don't share one with the agencies.
- `DATABASE_URL` on Vercel uses the **:6543 transaction** pooler, so the
  serverless backend reaches Supabase. `/api/health`, `/api/events` and the
  server-rendered `/events/{id}` all answer 200 against real data.

Re-check with `curl https://the-belonging-collective.vercel.app/api/health` before assuming
either has regressed; a stale "it only runs locally" belief here has already
cost one wrong diagnosis.

**Data.** The 37 real programs from `KWHab_Event_Test_Data.xlsx` are imported as
273 dated occurrences across the six agencies (Extend-A-Family, Karis Disability
Services, WRFN, Independent Living, Developmental Services Ontario, KW
Habilitation). The earlier seeded demo programming is archived, not deleted —
it used four categories (`Advice`, `Arts`, `Hangout`, `Food`) that predate the
real taxonomy and so could never match anyone's interests. Every live event now
carries a category from `CATEGORIES`; keep it that way, and don't un-archive the
demo rows without re-filing their categories first.
