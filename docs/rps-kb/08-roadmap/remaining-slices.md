# Remaining Slices — designs

## Slice B — Rework
**Flow:** packer scans mat → screen shows the mat with two buttons **Pack ✓** / **Rework ✗** (owner wants explicit inspection).
Rework → reason chips (stitching fault / cutting fault / material / other) + photo → unit `status='rework'`, `rework_logs` row,
`batches.rework_count++`. Batch stays at packing. The mat physically goes back to its stitcher (`stitched_by`).
Stitcher app gets a **Rework** section listing their rework units; fixing = scanning that unit while it's in `rework`
(allowed even though the batch is at packing) → `fixed_by/at`, status back to `pending`. Packer re-scans → Pack.
Batch completes when all units `packed`.

**Schema:** `ALTER TYPE <unit_status> ADD VALUE 'rework'`; `rework_logs(id, unit_id, batch_id, flagged_by → workers, reason,
photo_path, flagged_at, fixed_by → workers, fixed_at)`.
**Backend:** `POST /worker/units/:code/rework` (multipart: reason, photo) — store photo under an `UPLOAD_DIR` volume, serve
`/uploads/*` statically (swap to S3/R2 at deploy); `ScanUnit`: packer scanning a `rework` unit → 409 "mat is in rework";
stitcher scanning a `rework` unit → fix path regardless of batch phase. `GET /worker/rework` (my rework units).
Admin: rework badge on Packing view, rework rows in unit grid with photo thumbnail + reason, timeline entries.
**Mobile:** scanner in packing mode becomes two-step (scan → confirm card). Photo via `expo-image-picker` (native → rebuild).
**Open:** who photographs (packer assumed). Sticker reprint per unit lands here.

## Slice C — Materials, BOM, car-model CRUD, consumption
- `raw_materials` → `materials(id, code, name, type enum: rexine_roll|velcro|thread|piping|other, unit enum: m|pcs|spool|kg,
  quantity numeric, min_level numeric, is_active, …)`. Existing rolls migrate as type `rexine_roll`, unit `m`.
- `car_model_materials(car_model_id, material_type, qty_per_mat numeric)` — BOM by **type**, not specific item.
- Car model CRUD: `POST/PATCH /car-models` with BOM lines; admin **Cars** page.
- Consumption: at cutting-complete, for each BOM line deduct `qty_per_mat × quantity` from the oldest active material of that
  type (FIFO); rexine from the batch's chosen roll if set. Low-stock flag via `min_level`. Admin can correct manually.
- Stock page: grouped by type, unit-aware; keep Finished tab.
- Ask owner: rexine measurement method (metres) — decides precision of consumption.

## Slice D — Earnings (piece-rate)
- `piece_rates` exists per station. Likely extension: per (station, size_class) or per car model — ask owner.
- `GET /reports/earnings?from&to` → per worker: pieces (from `stitched_by`/`packed_by` counts within range) × rate → ₹.
- Reports page: Earnings tab/column; printable month-end sheet. Rate editor (small settings card).
- Scan idempotency doubles as wage-fraud protection — mention in demo.

## Slice E — Hardening + Deploy
- §3 workers: `is_active` check per request; one-time expiring enrollment codes (same endpoint); login rate-limit; admin PIN reset UI.
- §4 admin: refresh token in httpOnly cookie; rotate all secrets (dev `.env` is in git history); `SEED_ADMIN_PASSWORD` env.
- Deploy: Railway (API + Postgres, healthz check), Vercel (admin), EAS Build (keystore) + EAS Update (OTA). API URL → domain.
- Pilot week on real phones on the factory network; validate taffeta/sticker scan quality once a printer exists.

## Later / maybe never
Strict-FIFO toggle for open queues · soft "suggested worker" · kiosk print station · realtime WS · AI agent over the same
Guard · unit journey / public `/units/:code` page · audit-log viewer · batch cancel/edit · `packages/shared` types.
