# The Belonging Collective

An accessible, needs-first platform where Kitchener-Waterloo nonprofits post
community programming and members discover what fits them.

## Stack
- **Frontend:** Next.js (App Router) · Tailwind · Framer Motion — see [`frontend/`](frontend)
- **Backend:** FastAPI · SQLAlchemy — see [`backend/`](backend)
- **Database + storage:** Supabase Postgres (used as the DB; auth is custom, cookie-based)

## Run it locally

```bash
# 1. Backend  (http://localhost:8000)
cd backend
python3 -m venv .venv          # needs Python 3.10+; macOS system 3.9 crashes at
                               # import on the `X | None` type unions
.venv/bin/pip install -r requirements.txt

cp .env.example .env           # then set at least DATABASE_URL + JWT_SECRET

.venv/bin/alembic upgrade head # applies the schema (Alembic owns it)
.venv/bin/python -m app.seed   # optional sample data; idempotent
.venv/bin/uvicorn app.main:app --reload

# 2. Frontend (http://localhost:3000)
cd ../frontend
npm install
npm run dev                    # no env file needed locally — lib/api.ts
                               # defaults to http://localhost:8000
```

See [`backend/README.md`](backend/README.md) for the data model, permissions, and
API reference.

## Deploy (Vercel)

One project via [Services](https://vercel.com/docs/services) (root [`vercel.json`](vercel.json)):
`/api/*` routes to the FastAPI backend, everything else to the Next.js frontend.
Shared origin keeps the `SameSite=Lax` auth cookie working.

Production env vars:

| Service  | Var | Value |
|---|---|---|
| backend  | `DATABASE_URL` | Supabase pooler string, port 6543, `postgresql+psycopg://…` |
| backend  | `JWT_SECRET` | same as `backend/.env` |
| backend  | `COOKIE_SECURE` | `true` |
| backend  | `ROOT_PATH` | `/api` |
| backend  | `FRONTEND_ORIGIN` | deployed URL (for CORS) |
| frontend | `NEXT_PUBLIC_API_URL` | `/api` |
| backend  | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `MAIL_FROM` | organizer password-reset mail. **Unset = nothing is sent and the reset link is logged instead** |

Every setting is listed with a comment in [`backend/.env.example`](backend/.env.example)
and [`frontend/.env.example`](frontend/.env.example).

## Self-hosting

KWHab runs production on its own server and Postgres, deployed from release
tags. Nothing about it needs Vercel or Supabase:

- **Uploads**: set `STORAGE_BACKEND=local` and `UPLOAD_DIR` (a persistent,
  writable folder). Files are served by the backend at `/uploads/<name>`;
  set `UPLOAD_PUBLIC_URL` to serve `UPLOAD_DIR` from your web server instead.
- **Routing**: put the frontend and backend on one origin, `/api/*` → backend
  (stripping `/api`, or run `backend/index.py`'s `app`, which strips it),
  everything else → frontend. Set `ROOT_PATH=/api`, `NEXT_PUBLIC_API_URL=/api`.
- **Reminders**: call `GET /api/internal/reminders` daily with
  `Authorization: Bearer $CRON_SECRET` (Vercel's cron does this on Vercel).
- **Schema**: `alembic upgrade head` after each deploy.

### Releases

- Versions ready for real users are tagged `vX.Y.Z` with a GitHub release.
  The release notes list any **new environment variables** and any **new
  migrations**.
- Every setting is in an `.env.example`; a new one is added there in the same
  change that reads it.
- **Released migrations are never edited.** Production already has them
  applied, so a fix is always a new revision.

## License

[MIT](LICENSE).

## Roles
- **Members** — discover + attend programs (email + password sign-in)
- **Admins** — nonprofit organizers who add and edit their own programs
- **Superadmins** — admins who can also edit any program and manage member and
  admin accounts

Organizer accounts are created by a superadmin from the admin console, or by
invitation; there is no self-serve host sign-up. Organizers who forget their
password reset it by email. Removing an admin archives the account and its
programs together — nothing is deleted, and the programs stay attributed to the
organization that ran them rather than moving to whoever pressed Remove.
