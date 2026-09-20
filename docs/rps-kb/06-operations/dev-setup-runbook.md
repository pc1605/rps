# Dev Setup & Daily Runbook

## One-time
```bash
git clone git@github.com:pc1605/rps.git ~/Development/rps && cd ~/Development/rps
pnpm install                       # if blocked: pnpm approve-builds → select listed packages → pnpm install
docker compose up -d               # Postgres on 5433, Adminer on 8083 (VERIFY compose file name)
set -a; source .env; set +a
migrate -path apps/backend/migrations -database "$DATABASE_URL" up
cd apps/backend && go run ./cmd/seed   # admin owner@ambika.local / admin123 + reference data
```
Tools: Go, Node 20+, pnpm (corepack), golang-migrate CLI, Docker, Android Studio (SDK + emulator), adb.

## Every session (4 terminals)
```bash
# 1 backend
cd ~/Development/rps/apps/backend && go run ./cmd/server          # :8080
# 2 admin web
cd ~/Development/rps/apps/admin-web && pnpm dev                    # :3000
# 3 mobile (emulator)
cd ~/Development/rps/apps/mobile && pnpm exec expo run:android     # first run builds; later: pnpm start
adb reverse tcp:8081 tcp:8081                                      # if Metro can't connect after emulator restart
# 4 (optional) ngrok for phones off-LAN
ngrok http 8080 --domain=<your-static-domain>.ngrok-free.dev
```
If phones are on the same WiFi or on the laptop hotspot, skip ngrok and use the LAN/hotspot IP in `apps/mobile/.env` (rebuild after changing).

## Migrations
Always from the **repo root** (`.env` lives there). `version` / `up` / `force N` (after a dirty failure) / `down 1`.
Before writing a migration that references an enum: `docker exec -it rps_postgres psql -U rps_dev -d rps -c "\d <table>"`.

## Reset data
See `02-domain/data-model.md` → Reset. Then create a fresh batch through the UI/Postman; do not use the stale `demo-seed.sql`.

## Handy DB queries
```bash
P='docker exec -it rps_postgres psql -U rps_dev -d rps -c'
$P "SELECT name, station, badge_token FROM workers WHERE is_active;"                       # badges for enrollment
$P "SELECT batch_code, current_phase, status FROM batches ORDER BY created_at DESC LIMIT 10;"
$P "SELECT w.name, pl.phase, pl.quantity_completed FROM phase_logs pl JOIN workers w ON w.id=pl.worker_id ORDER BY pl.started_at;"
$P "SELECT bu.unit_code, ws.name stitched_by, wp.name packed_by FROM batch_units bu LEFT JOIN workers ws ON ws.id=bu.stitched_by LEFT JOIN workers wp ON wp.id=bu.packed_by ORDER BY bu.unit_code;"
$P "SELECT * FROM batch_assignments;"
```

## Debugging a 500
Handlers log the real error via zerolog before returning the generic 500 — read the backend terminal. Typical: column
count vs scan count mismatch; missing migration ("column … does not exist"); NULL into non-pointer.

## Git
Commit per slice: `[weekN] slice X: …`. Push to `github.com/pc1605/rps` (master).
