# Testing

## Test database (never `rps`)
DB tests, Postman runs and test seeds use the isolated **`rps_test`** database — never the developer's `rps`.
```bash
scripts/test-db.sh                  # drop (force) → create rps_test → all migrations → seed-dev.sh rps_test
export TEST_DATABASE_URL='postgres://rps_dev:rps_dev_password@localhost:5433/rps_test?sslmode=disable'
cd apps/backend && go test -race ./...
```
- Every DB test gets its pool from `testutil.DB(t)` (`internal/testutil/db.go`): reads `TEST_DATABASE_URL` only,
  **skips** when it's unset or unreachable, **fails** if it points at a database named `rps`, serialises DB tests
  across packages with an advisory lock, and **fails the test if it leaves rows behind** (row counts of all domain
  tables before vs after; `audit_log` and `batch_code_counters` excluded).
- Tests delete what they create in FK order (movements/plan → batches (units, logs cascade) → cars → groups …).
- The lefthook **pre-push** `go-test` sets `TEST_DATABASE_URL` to rps_test; without rps_test the DB tests skip.
- Rows left in a dev DB by test runs from before this isolation: `scripts/cleanup-test-junk.sql` (dry run by
  default; `psql "$DATABASE_URL" -v commit=1 -f scripts/cleanup-test-junk.sql` to apply). Run it yourself — agents don't.

## Automated Smoke Tests
```bash
# Real DB query smoke test (validates SELECT/Scan bindings, migrations, column aliases) — on rps_test
cd apps/backend && TEST_DATABASE_URL=… go test -v ./internal/batch -run TestReadQueriesSmoke
```

## Postman collection (`apps/backend/RPS.postman_collection.json`)
**Run only against a second backend on rps_test:** `cd apps/backend && DATABASE_URL=<rps_test url> PORT=8082 go run ./cmd/server`,
then select the **`RPS test`** environment (`apps/backend/RPS-test.postman_environment.json`, `baseUrl`
`http://localhost:8082/api/v1` — environment values override the collection's `baseUrl`). Never against :8080 / `rps`.

**Full run — from the repo root** (the Rework Flow photo `postman/fixtures/fault.jpg` is resolved against the
working directory, so a run from `apps/backend` fails 24 assertions):
```bash
npx --no-install newman run apps/backend/RPS.postman_collection.json -e apps/backend/RPS-test.postman_environment.json
```
Expected: 0 failed requests, 0 failed assertions (Nov 2026: 306 requests, 528 assertions). It can be re-run on the
same rps_test without resetting it. Add `--folder "<name>"` (repeatable) to run part of it. In the Postman app, set
Settings → General → Working directory to the repo root for the photo upload. Scripts read `baseUrl` with
`pm.variables.get` (environment wins), never `pm.collectionVariables.get` (that's the :8080 default); `Health` derives
the server root from `baseUrl`.

Variables: `baseUrl` (localhost:8080/api/v1), `accessToken`, `workerToken` (cutter), `stitcherToken`, `stitcher2Token`,
`packerToken`, badge vars, `batchId`, `workerBatchId`, `scanBatchId/Code`, `stockRollId`, `reportFrom/To`.
Convention: tests read `const responseData = pm.response.json().data`, assert `code` fields not messages (except worker-login
`invalid badge or pin`, manual-complete `.include('scanned')`, admin-forbidden `worker token required`).

Folders and run order:
1. **Auth** → Login (saves admin tokens)
2. **Workers (Admin)** → Create Worker (cutter Ramesh, PIN 1234; saves badge) · list · validations
3. **Worker Auth** → Worker Login (saves `workerToken`) · wrong PIN · unknown badge · me · admin route forbidden
4. **Reference**, **Batches** (create/list/get/validation), **Stock**
5. **Worker Phase Flow** — cutting only now: queue · start · start-again 409 · Cutter Complete · complete-again 409 · admin-token forbidden
6. **Multi-Worker Scanning** — self-contained (creates qty-4 batch, Stitcher A/B, packer; cutter start/complete; both stitchers join; split scans; idempotent re-scan; manual complete 400; last scan `phase_completed`; stitcher-after-move 409; packer joins via pre-request and packs all → `batch_completed`).
   Since Slice A the admin assigns the stitchers with quotas after cutting (`PUT /batches/{{scanBatchId}}/assignments`) before they join.
7. **Reports** — default range, dynamic 30-day with echo check, invalid range 400, worker 403, sort assertion.
8. **Materials (C1c)** — self-contained (logs in, builds a cutter token): types, variants, receive, adjust/waste/return,
   lot PATCH, movements pagination, groups, recipes, car group + overrides, resolve dry run, batch → cutter
   materials-needed → cut → batch materials; main 4xx; restores the car's group at the end.
   Full-run command with `--folder "Materials (C1c)"`.
9. **Entity pages (U1)** — worker detail/summary/history, busy-deactivate 409, throwaway packer: edit, reset PIN,
   login with it, deactivate → its token 401, reactivate; unit journey, car overview, lot detail; main 4xx. Same command with `--folder "Entity pages (U1)"`.
10. **Lists & search (U2)** — read-only: paging, views, sort, filters, `q` (no wildcard), 400s; search exact batch /
    mat, worker hit, 1-char empty; `stats.working`. Self-contained (logs in).
11. **Short-Cut Resolution**, **Assignments & Quotas**, **Rework Flow**, **Reports v2 (R1)**, **Stitching assignment (U3)**,
    **Workflow corrections (U3b)** — run inside the full run (U3b alone: see below).
Folders that need earlier ones in the same run: **Batches** needs `--folder "Auth" --folder "Cars & Reference"`
before it (each Newman run starts with empty variables).

Use **Collection Runner → Run folder** to avoid ordering mistakes. Re-runs create "PM …" workers; clear with the reset SQL.

## Full manual test (the "does the factory work" script)
Cast: cutter (Ramesh), two stitchers (Surya, Mahesh), packer (Raju) — 2–3 phones/emulator, PIN 1234.
1. Admin creates batch qty 10 → appears under Batches → Cutting; sidebar count.
2. Cutter: Start → Complete (10) → batch moves to **Ready to stitch**; both stitcher phones show nothing.
3. Admin: batch detail → check Surya 8, Mahesh 2 → `10/10 ✓` → **Assign & print labels** → taffeta PDF; batch under Stitching.
4. Surya's phone: `📌 Your share: 0/8`; Mahesh: `0/2`. Both Join.
5. Surya scans 8 → 9th → blue "Your share is complete". Mahesh re-scans one → amber. Mahesh scans 2 → "Stitching complete — sent to packing".
6. Admin: batch under Packing → **Print stickers** → PDF; button → Reprint. Units grid shows 🧵 names; timeline shows stitching ×2 (8 pcs / 2 pcs).
7. Packer: Join → scan all 10 → done screen; Batches → Completed; Stock → Finished +10; Reports credit Surya 8 / Mahesh 2 / Raju 10 / Ramesh 10.
8. Edge checks: kill app mid-scan → reopen → counts intact; scan a mat from another batch → red "Wrong batch"; edit Surya's quota below 8 → 400 toast.

## Curl snippets
```bash
API=http://localhost:8080/api/v1; T=<admin token>
curl -s -X PUT $API/batches/$BID/assignments -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '{"phase":"stitching","assignments":[{"worker_id":"<surya>","target_qty":8},{"worker_id":"<raj>","target_qty":2}]}'
curl -s -X POST $API/worker/units/scan -H "Authorization: Bearer $STITCHER" -H "Content-Type: application/json" -d '{"unit_code":"B-2026-005-001"}'
```

### U3b folder — "Workflow corrections (U3b)"
Self-contained (creates its own car item, cutter and stitcher; run after `Auth`): edit before cutting, cutter + admin
release, undo scan, cancel → spare stock, cancelled view, scanning a spare, reuse on New batch, spare write-off,
My work. Full-run command with `--folder Auth --folder "Workflow corrections (U3b)"`.

