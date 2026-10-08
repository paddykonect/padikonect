# Deploying Paddykonect (free tier)

Stack: **Vercel** (frontend) · **Render** (backend) · **Neon** (Postgres+PostGIS) · **Upstash** (Redis) · **Cloudinary** (files).

Real connection strings live in `backend/.env` (gitignored). This file uses
placeholders — never commit real secrets here.

---

## 0. Prereqs (one-time)
- Neon, Upstash, Cloudinary accounts exist. You already have:
  - `DATABASE_URL_NEON` (direct url) — in `backend/.env`
  - `REDIS_URL_UPSTASH` (`rediss://…`) — in `backend/.env`
  - Cloudinary cloud name / key / secret — in `backend/.env`
- On Neon, enable PostGIS once (Neon SQL editor): `CREATE EXTENSION IF NOT EXISTS postgis;`
  (Prisma migrations also try this, but running it first avoids permission surprises.)

---

## 1. Backend → Render
1. https://dashboard.render.com → **New → Blueprint**.
2. Connect the GitHub repo **paddykonect/padikonect**. Render reads `render.yaml`.
3. On the env-var prompt, paste the `sync:false` values:
   | Render key | Value (from `backend/.env`) |
   |---|---|
   | `DATABASE_URL` | `DATABASE_URL_NEON` (the **direct**, non-pooled url) |
   | `REDIS_URL` | `REDIS_URL_UPSTASH` (`rediss://…`) |
   | `CORS_ORIGIN` | leave blank for now → fill with Vercel url in step 3 |
   | `WEBAUTHN_RP_ID` | leave blank for now → frontend hostname in step 3 |
   | `WEBAUTHN_ORIGIN` | leave blank for now → frontend https url in step 3 |
   | `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | from `.env` |
   | `GOOGLE_CLIENT_ID` | from `.env` (optional) |
   | SMTP_*, SENTRY_DSN, GOOGLE_MAPS_API_KEY | optional — leave blank |
   (`JWT_*` + `OTP_HASH_PEPPER` auto-generate — don't touch.)
4. **Apply** → first deploy runs `prisma migrate deploy` then boots.
5. Verify: open `https://padikonect-api.onrender.com/api/health` → expect `{"status":"ok"}`.
   API docs: `/docs`. **Copy the service URL** — the frontend needs it.

> Free tier sleeps after ~15 min idle (first hit after sleep ~30–50s, and live
> WebSocket clients drop while asleep). Fine for MVP; upgrade for always-on WS.

---

## 2. Frontend → Vercel
1. https://vercel.com/new → import **paddykonect/padikonect**.
2. **Root Directory = `frontend`** (Vercel auto-detects Next.js).
3. Environment Variables:
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://padikonect-api.onrender.com/api/v1` |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | same `GOOGLE_CLIENT_ID` as backend (optional) |
4. **Deploy**. Copy the resulting url, e.g. `https://padikonect.vercel.app`.

---

## 3. Close the loop (CORS + WebAuthn + Google)
Back in **Render → padikonect-api → Environment**, set the 3 values you skipped,
using your real Vercel url (example `https://padikonect.vercel.app`):
| Key | Value |
|---|---|
| `CORS_ORIGIN` | `https://padikonect.vercel.app` (no trailing slash) |
| `WEBAUTHN_RP_ID` | `padikonect.vercel.app` (hostname only, no `https://`) |
| `WEBAUTHN_ORIGIN` | `https://padikonect.vercel.app` |

Save → Render redeploys. If using Google sign-in, add the Vercel url to the
OAuth client's **Authorized JavaScript origins** in Google Cloud Console.

---

## 4. Smoke test
- `GET https://padikonect-api.onrender.com/api/health` → ok
- Load the Vercel site, open a page that calls the API — no CORS errors in console.
- Sign up / log in end-to-end.

## Optional: seed data
Render → padikonect-api → **Shell**: `npm run prisma:seed` (or `prisma:seed:demo`).

## Redeploys
Every push to the default branch auto-deploys both (Render `autoDeploy`, Vercel git integration).
