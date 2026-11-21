# Stack, Ports, Environment

## Components
| App | Tech | Port | Location |
|---|---|---|---|
| Backend API | Go + Fiber v2, pgx/pgxpool (raw SQL), golang-migrate, golang-jwt, bcrypt, zerolog | **8080** | `apps/backend` |
| Test backend | same binary on the isolated `rps_test` DB — Postman / curl checks only (`RPS test` environment) | **8082** | `DATABASE_URL=<rps_test url> PORT=8082 go run ./cmd/server` (8081 is Metro) |
| Database | PostgreSQL 16 in Docker (container `rps_postgres`) | **5433** on host | `docker-compose.yml` at repo root |
| Adminer | DB browser | **8083** | Server field must be `postgres` (compose service name), not `db` |
| Admin web | Next.js 16 (App Router, Turbopack), shadcn/ui, TanStack Query v5, Zustand, axios | **3000** | `apps/admin-web` |
| Worker mobile | Expo SDK 57 **dev build** (not Expo Go), expo-router, Unistyles v3, expo-secure-store, expo-camera, TanStack Query, Zustand | Metro **8081** | `apps/mobile` |

Android package id: `com.pc165.rpsworker`. App name "RPS Worker", slug/scheme `rps-worker`.

## Credentials (dev)
- Postgres: user `rps_dev`, password `rps_dev_password`, db `rps`.
- Admin seed user: `owner@ambika.local` / `admin123` (created by `go run ./cmd/seed` in backend). Development only:
  with `SEED_ADMIN_PASSWORD` set the seed uses that instead, and with `ENV=production` it requires it.
- All test workers were created with PIN **1234**. Demo seed worker `Suresh` badge `DEMO-SURESH-001` (PIN = Ramesh's hash copy).

## Environment files
- **Root** `~/Development/rps/.env` — `DATABASE_URL`, JWT secrets, `PORT`, CORS origins. Migrations read this file. **Always source it from the repo root.**
- `apps/mobile/.env` — `EXPO_PUBLIC_API_URL=http://<host>:8080/api/v1`. **Baked into the JS bundle at build time**; any change requires a rebuild.
  - Emulator-only option: `http://10.0.2.2:8080/...`
  - LAN (emulator + phones on same WiFi): `http://192.168.1.9:8080/...` (DHCP — may change)
  - Laptop hotspot (stable): `http://10.42.0.1:8080/...`
  - ngrok (phones anywhere): `https://<domain>.ngrok-free.dev/api/v1` — needs `ngrok-skip-browser-warning` header (already added in api-client)
- Secrets note: the development secrets are the public placeholders from `.env.example` → generate new ones for the
  first deploy; the backend refuses the placeholders when `ENV=production` (see `auth-model.md` → Secrets).

## Monorepo tooling
pnpm workspace with **hoisted** node_modules — required by Expo/Metro. Both settings must exist:
- root `.npmrc`: `node-linker=hoisted`
- `pnpm-workspace.yaml`: `nodeLinker: hoisted` plus `allowBuilds` list (sharp, unrs-resolver, core-js). Add packages via `pnpm approve-builds` when pnpm blocks a postinstall.
`metro.config.js` has workspace `watchFolders`.

## Production (D46)
One AWS Lightsail server in Mumbai, everything in Docker Compose (`deploy/compose.yml`, project name `rps-server`):
Postgres, backend, admin web (`apps/admin-web/Dockerfile`, Next.js standalone), Caddy for HTTPS. One address: admin
at `/`, API at `/api/v1`. How to set it up and look after it: `06-operations/deploy-runbook.md`.

## Backend image (for the deploy, E2)
`apps/backend/Dockerfile` — build with `docker build -t rps-backend apps/backend` (about 38 MB). Not used in development.
- Runs `rps-server` as the user `rps` (not root), with `ENV=production`, `PORT=8080`, `UPLOAD_DIR=/data/uploads`.
- Also holds `rps-seed`, the migrations (`/app/migrations`) and `migrate` 4.17.0. Database changes are their own step,
  before the new server starts: `migrate -path /app/migrations -database "$DATABASE_URL" up`.
- Must be given: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FILE_URL_SECRET` (new values — the
  server refuses the development ones), `CORS_ORIGINS`; `PROXY_HEADER` behind a proxy; `SEED_ADMIN_PASSWORD` for the seed.
  With `ENV=production` the seed makes only the owner account (no demo cars or rolls).
- Phone notifications (N1): `FCM_CREDENTIALS_FILE` = the Firebase service-account key; in the compose setup it is
  `/srv/rps/secrets/firebase-key.json`, mounted read-only at `/run/secrets` (deploy runbook, step 5).
- **Rework photos** are files in `UPLOAD_DIR` (the database stores only file names, so the folder can be anywhere).
  The host must mount storage that outlives the container at `/data/uploads`, or photos are lost on every redeploy.
- No `.env`, uploads or Postman files go into the image (`apps/backend/.dockerignore`).
