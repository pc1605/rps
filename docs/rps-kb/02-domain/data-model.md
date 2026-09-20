# Data Model & Migrations

Migrations live in `apps/backend/migrations/`, applied with golang-migrate. **Run from the repo root**:
```bash
cd ~/Development/rps && set -a; source .env; set +a
migrate -path apps/backend/migrations -database "$DATABASE_URL" up      # or: version | force N | down 1
```

## Enum types (exact names — needed in migrations)
| Type | Values |
|---|---|
| `batch_phase` | cutting, stitching, packing, completed |
| `batch_status` | pending, in_progress, completed, cancelled, **awaiting_assignment** (added 006) |
| `worker_station` | cutter, stitcher, packer |
| unit status (**VERIFY name**, e.g. `unit_status`) | pending, packed, defective, dispatched — Slice B will add `rework` |

Postgres cannot drop an enum value; `ALTER TYPE … ADD VALUE IF NOT EXISTS` must not be used by a statement in the same transaction.

## Tables by migration

### 001 — users, audit_log
- `users(id uuid, email citext unique, password_hash, role owner|supervisor, …)`; `trigger_set_updated_at()`.
- `audit_log(id, actor_id, actor_role, entity_type, entity_id, action, before jsonb, after jsonb, ip, created_at)`.

### 002 — reference + batches + units
- `car_brands(id serial, name)`; `car_models(id serial, brand_id, name, size_class small|medium|large, pieces_per_set, piece_groups jsonb)` — `piece_groups` obsolete (whole-mat stitching), safe to drop later.
- `raw_materials(id uuid, roll_code unique, color, total_meters, remaining_meters, is_active, …)` — rolls only; Slice C generalizes to `materials`.
- `batch_code_counters(year int PK, last_number int)` + `next_batch_code()` → `B-YYYY-NNN`.
- `batches(id uuid, batch_code unique, car_model_id, roll_id nullable, quantity, current_phase batch_phase default 'cutting', status batch_status default 'pending', notes, rework_count int, created_by → users, version int, created_at, updated_at, stickers_printed_at timestamptz [006])`.
- `batch_units(id uuid, batch_id, unit_code unique 'B-YYYY-NNN-NNN', unit_number, status default 'pending', packed_by → workers, packed_at, created_at, stitched_by → workers [005], stitched_at [005])`. **Inserted at batch creation** (Hard Rule 18) via `generate_series`.

### 003 — workers
- `workers(id uuid, name, phone, station worker_station, badge_token unique, pin_hash bcrypt, is_active, created_by → users NOT NULL, last_login_at, …)`, `idx_workers_active`.

### 004 — phase_logs
- `phase_logs(id uuid, batch_id, phase batch_phase, worker_id, started_at default now(), completed_at nullable, quantity_completed nullable, notes)`.
- Original `idx_phase_logs_open UNIQUE(batch_id, phase) WHERE completed_at IS NULL` — **replaced in 005**.

### 005 — multi_worker_phases
- `batch_units` + `stitched_by`, `stitched_at`.
- Drop `idx_phase_logs_open`. New:
  - `idx_phase_logs_open_cutting UNIQUE(batch_id, phase) WHERE completed_at IS NULL AND phase='cutting'` → cutting stays one-worker.
  - `idx_phase_logs_open_per_worker UNIQUE(batch_id, phase, worker_id) WHERE completed_at IS NULL` → at most one open log per worker per batch+phase.
- `piece_rates(station worker_station PK, rate_per_piece numeric(10,2), updated_at)` seeded cutter 0 / stitcher 100 / packer 0.

### 006 — assignment_gate
- `ALTER TYPE batch_status ADD VALUE 'awaiting_assignment'`.
- `batch_assignments(batch_id → batches ON DELETE CASCADE, phase batch_phase, worker_id → workers, assigned_by → users, created_at, PK(batch_id, phase, worker_id))` + `idx_assignments_worker(worker_id, phase)`.
- `batches.stickers_printed_at`.

### 007 — assignment_quotas
- `batch_assignments.target_qty int CHECK (> 0)`, nullable (NULL = uncapped).

## Key invariants
- One open cutting log per batch; many open stitching/packing logs (one per joined worker).
- `phase_logs.quantity_completed` for stitching/packing = that worker's scan count, set when the phase auto-completes.
- Every unit's `stitched_by`/`packed_by` is set by the scan that completed it — the per-mat truth and the wage record.
- Quotas, when present on a phase, must sum to `batches.quantity`.

## Reset (dev)
```bash
docker exec -it rps_postgres psql -U rps_dev -d rps -c "
TRUNCATE phase_logs, batch_units, batches, audit_log, batch_assignments RESTART IDENTITY CASCADE;
DELETE FROM batch_code_counters;
DELETE FROM workers WHERE name LIKE 'PM %' OR name LIKE 'Postman%';"
```
Workers, users, car models, rolls survive. The root `demo-seed.sql` predates 005–007 — **do not run it**; a new seed
must set `stitched_by`, create assignments with quotas, and set `batch_code_counters(year, last_number)`.
