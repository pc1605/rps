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
**Run only against a second backend on rps_test:** `cd apps/backend && DATABASE_URL=<rps_test url> PORT=8081 go run ./cmd/server`,
then select the **`RPS test`** environment (`apps/backend/RPS-test.postman_environment.json`, `baseUrl`
`http://localhost:8081/api/v1` — environment values override the collection's `baseUrl`). Never against :8080 / `rps`.

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
   **Needs updating for Slice A/A.2:** after cutter complete the batch is `awaiting_assignment`; insert `PUT /batches/{{scanBatchId}}/assignments` with `{"phase":"stitching","assignments":[{"worker_id":…,"target_qty":3},{…,"target_qty":1}]}` before the joins; add a non-assignee join → 403 `not_assigned`; add a quota-exceeded scan → 409 `quota_reached`; add sum-mismatch → 400.
7. **Reports** — default range, dynamic 30-day with echo check, invalid range 400, worker 403, sort assertion.
8. **Materials (C1c)** — self-contained (logs in, builds a cutter token): types, variants, receive, adjust/waste/return,
   lot PATCH, movements pagination, groups, recipes, car group + overrides, resolve dry run, batch → cutter
   materials-needed → cut → batch materials; main 4xx; restores the car's group at the end.
   `npx -y newman@6.2.1 run apps/backend/RPS.postman_collection.json -e apps/backend/RPS-test.postman_environment.json --folder "Materials (C1c)"`

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
