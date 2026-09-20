# Stack, Ports, Environment

## Components
| App | Tech | Port | Location |
|---|---|---|---|
| Backend API | Go + Fiber v2, pgx/pgxpool (raw SQL), golang-migrate, golang-jwt, bcrypt, zerolog | **8080** | `apps/backend` |
| Database | PostgreSQL 16 in Docker (container `rps_postgres`) | **5433** on host | `docker-compose` at repo root (**VERIFY** filename) |
| Adminer | DB browser | **8083** | Server field must be `postgres` (compose service name), not `db` |
| Admin web | Next.js 16 (App Router, Turbopack), shadcn/ui, TanStack Query v5, Zustand, axios | **3000** | `apps/admin-web` |
| Worker mobile | Expo SDK 57 **dev build** (not Expo Go), expo-router, Unistyles v3, expo-secure-store, expo-camera, TanStack Query, Zustand | Metro **8081** | `apps/mobile` |

Android package id: `com.pc165.rpsworker`. App name "RPS Worker", slug/scheme `rps-worker`.

## Credentials (dev)
- Postgres: user `rps_dev`, password `rps_dev_password`, db `rps`.
- Admin seed user: `owner@ambika.local` / `admin123` (created by `go run ./cmd/seed` in backend).
- All test workers were created with PIN **1234**. Demo seed worker `Suresh` badge `DEMO-SURESH-001` (PIN = Ramesh's hash copy).

## Environment files
- **Root** `~/Development/rps/.env` — `DATABASE_URL`, JWT secrets, `PORT`, CORS origins. Migrations read this file. **Always source it from the repo root.**
- `apps/mobile/.env` — `EXPO_PUBLIC_API_URL=http://<host>:8080/api/v1`. **Baked into the JS bundle at build time**; any change requires a rebuild.
  - Emulator-only option: `http://10.0.2.2:8080/...`
  - LAN (emulator + phones on same WiFi): `http://192.168.1.9:8080/...` (DHCP — may change)
  - Laptop hotspot (stable): `http://10.42.0.1:8080/...`
  - ngrok (phones anywhere): `https://<domain>.ngrok-free.dev/api/v1` — needs `ngrok-skip-browser-warning` header (already added in api-client)
- Secrets note: early `.env` values are in git history → rotate everything at first deploy (§4 hardening).

## Monorepo tooling
pnpm workspace with **hoisted** node_modules — required by Expo/Metro. Both settings must exist:
- root `.npmrc`: `node-linker=hoisted`
- `pnpm-workspace.yaml`: `nodeLinker: hoisted` plus `allowBuilds` list (sharp, unrs-resolver, core-js). Add packages via `pnpm approve-builds` when pnpm blocks a postinstall.
`metro.config.js` has workspace `watchFolders`.
