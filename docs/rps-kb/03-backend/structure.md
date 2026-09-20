# Backend Structure (Go / Fiber)

`apps/backend/` — module `github.com/pc1605/rps/apps/backend`.

```
cmd/server/main.go        Fiber app: zerolog logger, CORS (AllowMethods GET,POST,PUT,PATCH,DELETE,OPTIONS), /healthz at root,
                          api := app.Group("/api/v1", guard), route registration per package, app.Listen(":" + cfg.Port)
cmd/seed/                 admin user + reference data
internal/
  auth/                   Guard middleware, Claims{Type user|worker}, login/refresh, RequireRole, ctx helpers
  audit/                  Write(ctx, tx, Entry{ActorID, ActorRole, EntityType, EntityID, Action, Before, After, IP})
  httpx/                  OK, BadRequest, Unauthorized, Forbidden, Internal, Error(c, status, code, msg)
  batch/                  ← core domain
    types.go              Phase/Status/UnitStatus consts, Batch, Unit, BatchDetail, CreateInput, PhaseForStation,
                          PhaseLogEntry, ScanResult, AssignmentEntry, AssignmentInput
    service.go            Service{pool}: Create, List, Get, GetStats, ListByPhase, StartPhase, CompletePhase,
                          ScanUnit, SetAssignments, MarkStickersPrinted; nextPhase; error sentinels
    handler.go            Fiber handlers + transitionResponse(err) mapping
    routes.go             RegisterRoutes(api, svc, authSvc)
  worker/                 CRUD, worker login (badge+PIN → 30d token), BadgeToken (enrollment re-show)
  reference/              GET car-models, rolls
  stock/                  rolls (create/patch/list, is_low at 10 m), finished goods aggregation
  report/                 WorkerProductivity aggregation (see api-reference.md)
migrations/               000001..000007
```

## Key functions in `batch/service.go` (what each guarantees)
- **Create** — validates model/roll, `next_batch_code()`, inserts batch + N units + audit, one tx.
- **List / Get** — display fields + unit roll-ups (`units_total/packed/stitched`), `stickers_printed_at`; Get adds
  `units[]` (with `stitched_by_name`, `packed_by_name`), `timeline[]`, `assignments[]` (with `target_qty`, `done_qty`).
- **GetStats** — in_cutting, awaiting_assignment, in_stitching (excludes awaiting), in_packing, completed_today, total_active.
  All phase counts use `status IN ('pending','in_progress')`. Scan args laid out vertically — keep them aligned.
- **ListByPhase(phase, workerID)** — the worker queue. See `key-queries.md`.
- **StartPhase** — phase match → assignment gate → cutting: exclusive claim; else: idempotent join → status in_progress.
- **CompletePhase** — cutting only (400 for others) → closes *my* log → `nextPhase`.
- **ScanUnit** — phase-aware, idempotent, joined-check, quota gate, apply, auto-advance. See `key-queries.md`.
- **SetAssignments(entries)** — validation rules (sum, floor, no-remove), replace rows, operate stitching gate, audit.
- **MarkStickersPrinted** — stamps `stickers_printed_at`.

## Adding a field end-to-end (checklist)
1. Migration (from repo root). Check enum type names with `\d <table>` first.
2. `types.go` struct field with JSON tag.
3. Every SELECT that should return it **and its Scan** (List, Get, ListByPhase are the usual three).
4. `features/batches/types.ts` in admin-web **and** mobile.
5. Postman assertions if it's asserted.
