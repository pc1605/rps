# Testing

## Postman collection (`rps.postman_collection.json` at repo root — VERIFY name)
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
