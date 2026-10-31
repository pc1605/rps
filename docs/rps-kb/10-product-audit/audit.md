# RPS product & UX audit

> Date: 2026-10-31 · Branch `agent/audit` · Analysis only, no code changed.
> Scope: admin web (`apps/admin-web`), worker app (`apps/mobile`), and the backend routes/queries behind them
> (`apps/backend/internal/*`). This is based on reading the code. No data was written and the app was not run, so
> anything below that describes what a user sees is inferred from the code, and the file:line references are what to check.

---

## 1. Executive summary: the 10 changes that would make RPS feel most mature

1. **Give every entity its own page and link it everywhere.** Add a Worker page first, then Unit, Item and Roll pages. Today only a batch has a page, and a name anywhere in the UI is dead text.
2. **Make the whole row clickable** in every `DataTable`. `onRowClick` already exists in `components/rps/data-table.tsx:32` but no list passes it.
3. **Fix the "who's working" data.** `GET /batches` never selects `active_workers` (`internal/batch/service.go:153-197`), so the admin batch list and the dashboard pipeline always say "Waiting for a worker" even when people are working.
4. **Rebuild reports on per-mat scan timestamps** instead of `phase_logs.quantity_completed`. Right now, stitching and packing work in a batch that's still running counts as zero, all pieces get dated to the day the phase started, and the date range is in UTC instead of IST.
5. **Add a global search / scan box** (batch code, unit code, item barcode, worker name), opened with ⌘K. A unit code currently leads nowhere.
6. **Paginate the batch list on the server and filter in the URL.** `/batches` returns every batch ever made, with 4 subqueries per row, polled every 10 s by 3 components. Add search, sort, and date and model filters.
7. **Add the missing admin corrections:** edit or cancel a batch, force-release a stuck claim, reassign mid-stitching from one place, deactivate a worker, reset a PIN. Today none of these exist in the API or the UI.
8. **Add a "Needs attention" inbox** combining short cuts, ready-to-assign batches, rework decisions, stuck batches (no scan in N hours), idle claims and low stock, with a count badge in the header.
9. **Give workers a "My work today" screen** (mats done today, this week, ₹ estimate, rework returned) and replace the false "changes will sync" offline promise with honest wording.
10. **Record phase transitions in a structured `batch_events` table**, so cycle time, waiting time per phase, ageing and short-cut frequency become simple, exact queries.

---

## 2. Findings

Impact: H/M/L = how much it changes the owner's or a worker's daily experience. Effort: S < ½ day, M ≈ 1–2 days, L ≈ 3+ days.

### 2a. Entity model & navigation

| ID | Area | Screen / file | Problem (what the user experiences) | Proposed fix | Impact | Effort | Depends on |
|---|---|---|---|---|---|---|---|
| N1 | Entities | Workers `features/workers/components/worker-list.tsx` | Workers are only a table row. The owner can't see what Surya is doing now, his history, output or rework. | `/workers/[id]` page (spec §4.1). Backend `GET /workers/:id` (profile + now + stats) and `GET /workers/:id/activity?from&to`. | H | L | N2, W1 |
| N2 | Entities | Timeline `batch-timeline.tsx:64`, unit card `unit-card.tsx:71`, assign card `assign-stitchers-card.tsx:126`, rework table `rework/page.tsx:74`, decision card `decision-card.tsx:179`, report table `worker-report-table.tsx:41`, pipeline names `pipeline.tsx:62` | Worker names appear in 7+ places and none of them can be clicked. | A shared `<WorkerLink id name/>` primitive (hover card showing station + current batch) used everywhere. Backend payloads need `worker_id` next to every `*_name` (units: `stitched_by`, `packed_by`; rework: `flagged_by`, `fixed_by`, stitcher). | H | M | N1 |
| N3 | Entities | Unit grid `unit-card.tsx:61`, rework `rework/page.tsx:33`, `decision-card.tsx:125` | A unit code is just mono text. There's no way to see a mat's full journey (cut by → stitched by → flagged → fixed → packed), and you can't look up a scanned code. | `/units/[code]` page (spec §4.2). Backend `GET /units/:code`. Link unit codes everywhere. | H | M | — |
| N4 | Entities | Cars `app/(dashboard)/cars/page.tsx` | An item has no page. You can't answer "how many Baleno R mats did we make this month, how many are in stock, what's its rework rate?" | `/cars/[id]` page (spec §4.3). The row opens it; editing stays in a dialog. | M | M | R-series |
| N5 | Entities | Stock `roll-list.tsx`, batch detail header | A roll isn't linked to the batches that used it, and the batch detail page doesn't show its roll even though `roll_code` is in the payload. | Show the roll on batch detail. `/stock/rolls/[id]` lists the batches using it (spec §4.4). Slice C will generalise this to materials/lots. | M | S | Slice C |
| N6 | Entities | Rework | There's no rework-round page or history view. The UI only shows open rounds (`rework/page.tsx:107-108`), even though the API supports `status=all`. | Add a "History" tab with filters for reason, stitcher, decision and date. Unit page shows rounds inline (spec §4.5). | M | S | N3 |
| N7 | Nav | `decision-card.tsx:83` | After a re-cut, the toast's "New batch" link goes to `/batches?phase=cutting`, not to the new batch. | Return `new_batch_id` and link straight to it. | L | S | — |
| N8 | Nav | Batch detail `batches/[id]/page.tsx:54` | "Back" always goes to `/batches` and loses the phase tab you came from (e.g. `?phase=packing`). | Back to the referrer list with its filters (keep `?phase=` etc. in the link), and use breadcrumbs: Batches › Packing › B-2026-041. | M | S | L2 |
| N9 | Nav | Batch detail | Child (remainder or re-cut) batches aren't listed on the parent. You only see "↩ from" on the child. | "Related batches" row: parent, split remainder, re-cut spawns. Needs a `WHERE parent_batch_id = $1` query and an index (P4). | M | S | P4 |
| N10 | Nav | Mobile `app/batch/[id].tsx:28` | The worker batch screen finds the batch in the cached queue list. A deep link, or a batch that just left your queue, shows "Batch not found". | Fetch `GET /worker/batches/:id`, with an explicit "moved on to packing" state. | M | S | — |

### 2b. Lists

| ID | Area | Screen / file | Problem | Proposed fix | Impact | Effort | Depends on |
|---|---|---|---|---|---|---|---|
| L1 | Lists | Every `DataTable` user: batches `batch-list.tsx:176`, workers, cars, rework, reports, rolls | Clicking a row does nothing. Only the mono code link works, and on cards below `md` the whole card is dead except that link. | Pass `onRowClick` (router push) everywhere. Add a hover background (`hover:bg-accent`) in `DataTable` when clickable. Keep the inner `<Link>` for middle-click / open in new tab, and stop row clicks bubbling from buttons (already done for stickers). | H | S | — |
| L2 | Lists | Batches `batch-list.tsx:121-166` | No search, sort, or filter by model, date or status. Only the phase tab is in the URL. "Completed" grows forever. | Search box (code / model / barcode), filter chips (item, product line, created range, has rework, short cut), sortable headers. All of these as URL params. | H | M | P1 |
| L3 | Lists / scale | `GET /batches` `service.go:153` | No pagination. At 5,000 batches every page that shows the sidebar or dashboard loads the whole list (≈5,000 rows × 4 subqueries) every 10 s. | Server-side `?phase=&status=&q=&from=&to=&cursor=&limit=50`. The Completed tab defaults to the last 30 days. The dashboard uses a small dedicated endpoint. | H | M | P1 |
| L4 | Lists | Workers list | No filter by station or active, no output column, no "working now" dot. | Station tabs, Active/Inactive toggle, "Now" column (current batch link), "Today" mats column. | M | S | N1 |
| L5 | Lists | Rework "With stitchers" `rework/page.tsx:218` | No age column ("out for 3 days"), so a stuck repair can't be spotted. | Age column, sorted oldest first, amber when older than X hours. | M | S | — |
| L6 | Bulk | Batches packing view | Stickers are printed one batch at a time. You can't select rows to print several, or print taffeta labels from the list. | Row checkboxes + "Print stickers for selected" (one merged PDF). | L | M | L1 |
| L7 | Export | Batches, Reports, Rework | No CSV or print export anywhere, so the owner retypes data into Excel. | "Export CSV" on reports and lists (server streams CSV with the same filters). Print stylesheet for the wage sheet. | M | S | L3 |

### 2c. Global

| ID | Area | Screen / file | Problem | Proposed fix | Impact | Effort | Depends on |
|---|---|---|---|---|---|---|---|
| G1 | Search | `components/layout/app-shell.tsx` (header) | No global search. A barcode scanner plugged into the laptop types a code into nothing. | ⌘K command palette (`components/ui/command.tsx` already exists) + a header input. `GET /search?q=` returns batches / units / items (barcode) / workers. An exact unit-code match jumps straight to its page, so a USB scanner works. | H | M | N1, N3 |
| G2 | Attention | Dashboard attention cards `dashboard/page.tsx:40-106` | The attention cards are a good start but incomplete: no stuck batches, no idle claims (a cutter who pressed Start 2 days ago), no ready-to-assign list (only a count), and they only show on the dashboard. | An `/inbox` (or header bell) fed by `GET /attention`: short cuts, ready to assign, rework decisions, stuck (no scan or transition in > N h), open claims > N h, low stock. Same cards on the dashboard. | H | M | E1 |
| G3 | Roles | `internal/*/routes.go` | Owner and supervisor are identical. Only 6 routes check the role. There's no user management and no Settings page (piece rates, thresholds, factory hours). | `/settings`: users (invite supervisor, deactivate), piece rates, "stuck" threshold, low-stock threshold, timezone. Decide what supervisors can't do (Q7). | M | M | Q7 |
| G4 | Security | `internal/auth/handler.go:69` `GET /workers/:id/enrollment`; `GET /batches*`, `/rework` | Read routes don't check the token type. A **worker** token can read every batch (including worker IDs) and fetch any worker's badge token. A badge plus a guessed 4-digit PIN gives a login. | Put `RequireRole("owner","supervisor")` on the admin read routes and the enrollment route. Already listed in the Slice E §3 notes, so do it there. | H | S | Slice E |
| G5 | Audit | — | `audit_log` is written carefully but there's no screen for it. "Who reduced B-2026-031?" means using psql. | An "Activity" tab on batch, worker and unit pages (`GET /audit?entity_type&entity_id`) + an owner-only global audit list. | M | S | N1, N3 |
| G6 | Shortcuts | — | No keyboard shortcuts. | ⌘K, `g b` / `g w` / `g r` for navigation, `/` to focus search, `n` for a new batch. Cheap once G1 exists. | L | S | G1 |
| G7 | Freshness | `features/batches/hooks.ts:6-7` | Polling is in place but nothing shows when data was last updated. The rework page has a manual Refresh button but the batch pages don't. | A small "Updated 4 s ago" indicator in the header (from `dataUpdatedAt`) and turn polling off when the tab is hidden. | L | S | — |

### 2d. Workflow gaps (things done outside the app today, and dead ends)

| ID | Area | Screen / file | Problem | Proposed fix | Impact | Effort | Depends on |
|---|---|---|---|---|---|---|---|
| W1 | Workers | `internal/worker/routes.go` | No `PATCH /workers/:id`. You can't deactivate a worker, change their station or phone, or reset a PIN. The only option is SQL. Deactivation also doesn't kill an existing 30-day phone token (Slice E §3). | `PATCH /workers/:id` (name, phone, station, is_active), `POST /workers/:id/reset-pin`, `POST /workers/:id/rotate-badge`. Check `is_active` on every request. UI on the Worker page. | H | M | Slice E §3 |
| W2 | Batches | — | You can't edit a batch (quantity, item, notes, roll) before cutting starts, or cancel it. `batch_status` already has `cancelled`, but nothing sets it. A typo in quantity means a bad batch forever. | `PATCH /batches/:id` (allowed while `cutting/pending`). `POST /batches/:id/cancel` with a reason (allowed until packing, deletes un-stitched units or marks them; AlertDialog to confirm). | H | M | — |
| W3 | Claims | Mobile cutter `app/batch/[id].tsx:122`; admin | A cutter who taps "Start cutting" by mistake, or goes home, locks the batch. The cutter can't release it, and the admin can't force-release or reassign it. | Worker "Release" (cutting, before Complete). Admin "Release claim" on the timeline's open entry. Both audited. | H | S | — |
| W4 | Assignment | `assign-stitchers-card.tsx` | Reassigning mid-stitching works, but only from the batch page. If Surya is absent, the owner has to open each of his batches. There's also no packing assignment UI, even though the backend supports it. | Worker page → "Move remaining work to…" (rewrites quotas across his open batches). Show a packing assignment card when the owner wants it (Q2). | M | M | N1 |
| W5 | Short cut | `short-cut-panel.tsx:53-92` | Split / Reduce / Re-cut run immediately with no confirmation. Reduce **deletes units** (`service.go:770`). The reason picker only applies to Reduce, and Split/Re-cut don't capture a reason. The KB says un-cut units are "cancelled", but they're deleted. | Use an AlertDialog for each action. Capture the reason for every action. Store it in `batch_events` (E1). Fix the KB wording. | M | S | E1 |
| W6 | Dispatch | Stock › Finished `stock/service.go:186` | `dispatched` exists as a unit status but nothing sets it, so the finished-goods count only ever goes up. | A dispatch flow: scan or select units → `dispatched` (+ customer/challan note). Later this becomes a Dispatch entity. Ask the owner (Q9). | M | M | Q9 |
| W7 | Stickers | Batch detail `batches/[id]/page.tsx:81` | The packing-sticker print only exists in the list's packing view. The batch page only has a "Labels PDF" (taffeta) button, and there's no per-unit reprint for a damaged sticker. | Batch page action menu: Taffeta labels · Packing stickers · Reprint one unit. Unit page: reprint. | M | S | N3 |
| W8 | Recovery | Mobile scanner `app/scan/[batchId].tsx` | When a co-worker finishes the phase, your next scan shows a red "not at your station's phase" (KB, Known UX edges). | Map `wrong_phase` to a friendly "Batch moved on ✓" and go back to the queue. | L | S | — |

### 2e. Mobile worker UX

| ID | Area | Screen / file | Problem | Proposed fix | Impact | Effort | Depends on |
|---|---|---|---|---|---|---|---|
| M1 | Own output | `app/home.tsx` | A worker can't see their own output. Stitchers are paid per mat but can't check "how many today / this week". This is the most motivating screen and it's missing. | A "My work" header card on home: today's mats (big number), this week, ₹ estimate (Slice D), rework returned to me. `GET /worker/me/summary`. | H | M | R1, Slice D |
| M2 | Offline | `home.tsx:236`, `batch/[id].tsx:149`, `scan/[batchId].tsx:382` | The banner says "changes will sync when you reconnect", but nothing is queued. Scans are rejected offline (`scan/[batchId].tsx:196`). Workers will believe they scanned. | Short term: honest wording ("No connection — scans won't count until you're back online") plus a red full-screen state in the scanner. Longer term: an offline scan queue. Scans are idempotent server-side, so replaying them is safe. | H | S → L | — |
| M3 | Literacy | `lib/strings.ts`; `home.tsx`, `batch/[id].tsx`, `scan/[batchId].tsx` | `strings.ts` only covers inspect, scanner and rework. Queue, batch, scanner and login copy is hard-coded English ("Report cut", "Join batch", "Assigned workers", "Point at a unit QR label"), so Hindi translation is blocked. | Move all copy to `strings.ts`. Add a language switch (Q1). Pair every action with an icon. | H | M | Q1 |
| M4 | Literacy | Home batch card `home.tsx:103-163` | The card leads with the batch code (`B-2026-041`), which means nothing to a stitcher. What a worker recognises is the car model and their remaining count. | Lead with the car model (large) and a size icon or colour. Show "3 left for you" as a big number. Make the batch code small. | M | S | — |
| M5 | Literacy | Cutter `batch/[id].tsx:79` | Reporting a short count shows a long English sentence in an `Alert`. | A visual confirm: big "8 of 10" with ✂️ and a red/green colour, two large buttons. | M | S | — |
| M6 | Onboarding | `login.tsx` | First run is just a form. There's no "who am I" confirmation after enrollment, and no hint that the phone is now theirs. | After enrollment: a "You are Surya · Stitcher ✓" screen with photo/initials. Ask for the camera permission up front. | L | S | — |
| M7 | Feedback | `lib/feedback.ts` | Good: sounds and haptics exist. Missing: the quota-complete sound isn't distinct, and nothing tells the worker "batch complete" except text on screen. | Distinct quota/complete sounds (already `FeedbackKind`). Full-screen colour flash for complete. | L | S | — |

### 2f. Consistency & polish

| ID | Area | Screen / file | Problem | Proposed fix | Impact | Effort | Depends on |
|---|---|---|---|---|---|---|---|
| C1 | Design system | `assign-stitchers-card.tsx:103-150` | The most-used admin control breaks AGENTS.md: `text-amber-600`, `text-emerald-600`, `text-[10px]`, `text-xs`, `text-sm`, a mono uppercase heading, `border-primary`, and amber used for "not balanced" (amber means "act here"). Also `range-picker.tsx:55-62`, `enrollment-qr-dialog.tsx:54,72`, `item-dialog.tsx:207`, `app/(auth)/login/page.tsx:20` (`bg-zinc-950`), mobile `rework/[id].tsx:292` (`fontSize: 24`). | Re-token it: `SectionTitle`, `text-caption`, `text-brand` only for the "ready" call-to-action, `text-danger` / `text-phase-completed` for unbalanced / balanced. | M | S | — |
| C2 | Copy | Across apps | Terminology drifts: **mat / unit / piece / pcs** (`batch-timeline.tsx:84` "pcs", Reports "Pieces", unit grid "Units", assign card "mats"). **Item / Car / Model** (nav "Cars", dialog "Item", table "Model"). **Order / batch** (empty states say "Create the first order"). **Overview / Dashboard / "Today at RPS"**. **Ready to stitch / Ready for stitching**. **Re-cut / Recut**. Reports shows the raw station key `stitcher` (`worker-report-table.tsx:51`) instead of `STATION_LABEL`. | A glossary in `@rps/shared` with labels: *mat* for the physical thing (UI), *unit* only in code; *item* for a catalog row; *batch* (never "order"); "Ready to stitch" everywhere. | M | S | — |
| C3 | Dates | `range-picker.tsx:14`, `report/handler.go:22-31`, `service.go:378` | Dates are in UTC. The client builds `YYYY-MM-DD` with `toISOString()` (UTC) and the server parses it as UTC midnight. In IST, before 05:30 "Today" means yesterday, and "today" really runs 05:30 → 05:30. `completed_today` uses the DB's `CURRENT_DATE`. | One factory timezone (`Asia/Kolkata`) in config. Format dates locally on the client and parse with `time.ParseInLocation` on the server. Use `AT TIME ZONE` in SQL. | H | S | — |
| C4 | States | Rework page `rework/page.tsx:110` | Uses `isLoading` (AGENTS.md says `isPending`) and nests a DataTable `empty` inside an outer empty check (dead code). Several pages have no error state (dashboard `useBatches` error → silently "No batches yet"). | Standardise loading/empty/error per page. | L | S | — |
| C5 | Reports UI | `reports/page.tsx:17` | The "Pieces" total adds cutter cut-pieces, stitched mats and packed mats into one meaningless number. | Show totals per station, never across stations (see R-series). | M | S | R1 |

### 2g. Data trust

| ID | Area | Screen / file | Problem | Proposed fix | Impact | Effort | Depends on |
|---|---|---|---|---|---|---|---|
| D1 | Live data | `internal/batch/service.go:153-197` (List) vs `batch-list.tsx:88`, `pipeline.tsx:20-29` | `active_workers` is only selected in `ListByPhase` (the worker queue), not in admin `List`. The admin list's 👤 line never renders, and the pipeline always says "Waiting for a worker" while people are working. The dashboard says the floor is idle when it isn't. | Add the `active_workers` subquery to `List` (or the new paginated query). Add a smoke-test assertion. | H | S | — |
| D2 | Reports | `internal/report/service.go:22-55` | Pieces come from `phase_logs.quantity_completed`, which for stitching and packing is only written when the **whole batch's phase completes** (`service.go:209-213`). A stitcher who did 8 of 10 today shows 0 until the last mat is scanned, perhaps tomorrow. Logs are also bucketed by `started_at`, so mats finished today count on the join day. | Count output from `batch_units.stitched_at/stitched_by` and `packed_at/packed_by` within the range (the wage truth). Cutters keep `phase_logs` (by `completed_at`). | H | S | P2 |
| D3 | Reports | Same, "Avg / batch" | A stitching log stays open from Join until the *last co-worker* finishes, so a fast stitcher who did 2 mats in 40 min shows a 6 h duration. | Drop "avg/batch". Use active time = first scan → last scan per worker-day, and mats/hour from that (R5). | M | S | D2 |
| D4 | Counts | `batches/[id]/page.tsx:48` (stitched count computed client-side), `service.go:253` (`UnitsPacked` excludes `defective`/`dispatched`) | A completed batch with one written-off mat shows "Packed 9/10", which looks unfinished. Dispatched mats would also stop counting as packed. | Server returns `units_good`, `units_written_off`, `units_dispatched`. The UI shows "9 packed · 1 written off". | M | S | — |
| D5 | Counts | `service.go:378` `completed_today` | Uses `updated_at::date`. Any later update to a completed batch (sticker reprint, notes) moves it to "today", and timezone per C3. | Use the `completed_at` event timestamp (E1). | M | S | E1 |
| D6 | History | `SetAssignments` (full replace) | Quota history is lost: `batch_assignments.created_at` resets on every save and old targets are overwritten, so "did Surya meet his quota?" can't be answered afterwards. | Write assignment changes to `batch_events` (before/after targets), or keep `target_qty` snapshots in phase_logs at close. | M | S | E1 |
| D7 | Wages | `rework.go:452,466` | A written-off mat keeps `stitched_by`, so it counts as a paid piece. Whether it should is a policy question (Q4b). | Decide policy. Expose `defective` separately in the earnings query. | M | S | Q4 |
| D8 | Polling | Admin `hooks.ts:6-7`, mobile `features/batches/hooks.ts:30` | The admin has 10 s / 5 s polling, which is OK. On mobile the scanner progress pill doesn't see co-workers' scans (KB). The admin batch detail polls a full detail payload (units + rework + photos signed URLs) every 10 s. | Keep polling but make it cheaper: ETag/`version` short-circuit (`batches.version` already exists) → 304. | L | M | — |

### 2h. Performance & scale

| ID | Area | Screen / file | Problem | Proposed fix | Impact | Effort | Depends on |
|---|---|---|---|---|---|---|---|
| P1 | Scale | `GET /batches` | Unbounded rows × 4 correlated `COUNT(*)` subqueries, called by dashboard, pipeline and batch list (shared query key, so it's deduped) every 10 s, plus stats every 5 s on every page. | Pagination (L3). A `GROUP BY` join for unit roll-ups instead of per-row subqueries. A separate tiny dashboard endpoint. | H | M | — |
| P2 | Indexes | migrations | No index on `batch_units(stitched_by, stitched_at)`, `batch_units(packed_by, packed_at)`, `rework_logs(batch_id)`, `rework_logs(flagged_at)`, `batches(parent_batch_id)`. Every report, worker page, rework list and quota check scans these. | One migration with these 5 indexes before building R1 or the worker pages. | M | S | — |
| P3 | Payload | `GET /batches/:id` | Re-signs every rework photo URL on each 10 s poll, so `?exp=&sig=` changes and the browser cache misses. | Round `exp` to a 1 h bucket so URLs are stable within a window. | L | S | — |
| P4 | Indexes | Related batches (N9) | `parent_batch_id` lookup with no index. | Covered by P2. | L | S | P2 |

---

## 3. Reports proposal

**Principle:** count mats from per-mat scan facts (`batch_units`), count time from events (`phase_logs` + the proposed `batch_events`), and always split by station. ★ marks the 6 most valuable for the owner.

**Schema gap E1 (`batch_events`):** today, phase entry and exit times are scattered across `phase_logs` (cutting start/end), the first stitching `started_at`, the last `stitched_at`, `audit_log` JSON and `updated_at`. Proposal:
`batch_events(id, batch_id, at timestamptz, kind text, from_phase, to_phase, from_status, to_status, actor_user_id, actor_worker_id, data jsonb)`,
written in the same tx as every transition: create, cut-start, cut-complete (cut qty), short-resolve (action, reason), assigned (targets), stitching-complete, packing-complete, cancel, edit, claim-release. A backfill from `audit_log` + `phase_logs` is possible for existing rows.

| # | Metric | Question it answers | Formula | Data source | Available now? | Suggested visual |
|---|---|---|---|---|---|---|
| R1 ★ | **Throughput** (mats out per day/week) | Are we producing more or less than last week? | `COUNT(bu) WHERE packed_at in day` (by IST day), also stitched/day and cut/day | `batch_units.packed_at`, `stitched_at`; `phase_logs` (cutting, `completed_at`) | **Y** | Bar per day (last 30), stacked by product line; WoW delta stat |
| R2 ★ | **WIP & ageing per phase** | Where is work piling up, and how old is it? | Batches (and mats) currently in each phase/status, bucketed by time since entering that phase: <4 h, 4–24 h, 1–3 d, >3 d | Phase entry time: needs E1 (today approximated from `phase_logs` / `updated_at`, which is unreliable) | **Partial** (needs E1) | Pipeline with ageing heat strip under each stage; click → filtered list |
| R3 | **Cycle time per phase** | How long does a batch take from order to stockyard, and which phase is slow? | median/p90 of (phase exit − phase entry) per phase, plus *waiting* time (awaiting_assignment, pending before first join) vs *working* time | E1; partially `phase_logs` | **Partial** | Horizontal stacked bar per week: wait vs work per phase |
| R4 ★ | **Bottleneck / stuck batches** | What needs me right now? | Batches whose last event or last scan is older than threshold T (setting), plus ready-to-assign older than T | E1 + max(`stitched_at`,`packed_at`) per batch | **Partial** | Inbox list (G2) and red count on dashboard |
| R5 ★ | **Worker output & mats/hour** | Who is productive, who is idle? | Per worker-day: mats = count of attributions; active span = last scan − first scan; mats/hour = mats / span. Cutters: pieces / (complete − start) | `batch_units` attributions + timestamps; `phase_logs` for cutters | **Y** (approximation, no attendance) | Table per worker with 14-day sparkline; worker page chart |
| R6 | **Quota adherence** | Did assigned stitchers deliver their share on time? | per assignment: done / target, and time to finish share | `batch_assignments` + `stitched_by` | **Partial**: live only; history lost on reassign (D6) | % bar per worker on worker page |
| R7 ★ | **Rework rate per stitcher & per reason** | Who causes defects, and what kind? | rounds where `bu.stitched_by = w` / mats stitched by w; split by `unnest(reasons)`; plus fix turnaround `fixed_at − COALESCE(decided_at, flagged_at)` | `rework_logs` ⨝ `batch_units` | **Y** | Ranked bar (rate %) + stacked bar by reason; worker page panel |
| R8 | **First-pass yield** | What share of mats pass packing first time? | mats packed with zero `rework_logs` / mats packed, by week / item / stitcher | `batch_units`, `rework_logs` | **Y** | Single big % with weekly line |
| R9 | **Short-cut frequency** | How often do cutters come up short, and why? | count of short-resolve events by action & reason / cut-completes; shortage mats | `audit_log` JSON (`event: short_cut_*`) today; E1 later | **Partial** (audit only; no reason for split/recut, W5) | Monthly count + reason breakdown |
| R10 | **Write-offs & re-cuts** | How much do we lose? | count `decision IN ('write_off','recut')` by reason, item, stitcher | `rework_logs` | **Y** | Table + monthly total |
| R11 | **Late batches** | Are we delivering on time? | batches past due date and not complete | **N**: no `due_date` / customer on `batches` | **N** | Inbox + list filter |
| R12 | **Item mix** | What sells and what we make | mats packed per item / product line / size | `batch_units` ⨝ `car_models` | **Y** | Table on Cars page; top-10 bar |
| R13 | **Earnings** (Slice D) | What do I owe each worker this month? | Σ attributed mats × rate(station [, size]) − policy for write-offs (Q4) | `piece_rates` (per station only) | **Partial**: rates per size missing | Printable wage sheet, per-worker detail |
| R14 | **Material use & cost per mat** (Slice C) | What does a mat cost us? | consumption per batch / mats good | **N**: needs `materials`, BOM, consumption ledger, unit cost | **N** | Per-item cost card |

**Suggested Reports page layout:** tabs **Overview** (R1, R2, R8, R4 count) · **Workers** (R5, R7, R6) · **Quality** (R7, R8, R9, R10) · **Earnings** (Slice D). Every number links to a filtered list and every table exports CSV. All dates are in IST.

---

## 4. Entity page specs

### 4.1 Worker: `/workers/[id]` (full spec)

**Header:** name, station chip, Active/Inactive chip, phone (tel link), "Last seen on phone {relative}" (`last_login_at`; the scan time would be better). Actions: **Show enrollment QR** (existing `EnrollmentQrDialog`), **Reset PIN** (dialog: new 4-digit, shown once), **Edit** (name, phone, station; station changes are blocked while they have open claims or assignments), **Deactivate / Reactivate** (AlertDialog: "Their phone will be signed out. Open assignments: 2 batches, 5 mats remaining → reassign first?"). Rotating the badge is in a ⋯ menu.

**Now (live, 10 s poll):**
- Current open claims: batch link, item, phase, "since 10:42", their scans in it (`3 of share 8`).
- Assigned but not joined: list with remaining share.
- Open rework assigned to them (stitchers): unit links, age.
- Empty state: "Not working on anything right now".

**Output** (range picker shared with Reports, default last 14 days, IST):
- Stats: mats today · this week · range total · mats/hour (R5) · ₹ estimate (Slice D).
- Daily bar chart of mats (stitched or packed or cut, by station).
- For stitchers: rework caused (count, rate %, top reason) and rework fixed (count, median turnaround).
- For packers: mats inspected · flagged rate (helps spot a too-strict or too-lax packer).
- Quota adherence for completed assignments (needs D6).

**Work history** (paginated table, row → batch): date · batch · item · phase · their mats · duration (first→last scan) · quota (target) · rework from this batch.

**Activity** tab: audit entries where they're the actor or the entity (claims, scans summary per batch, logins, PIN resets).

**Backend:** `GET /workers/:id` (profile + now), `GET /workers/:id/summary?from&to`, `GET /workers/:id/history?cursor`, `PATCH /workers/:id`, `POST /workers/:id/reset-pin`. Needs indexes from P2.

**Entry points:** every `WorkerLink` (N2), the Workers list row, the Reports row, ⌘K.

### 4.2 Unit / mat: `/units/[code]`
Header: unit code (mono), item, batch link, status chip. **Journey** timeline: created → cut (cutter, from the batch's cutting log) → stitched (who, when) → each rework round (flagged by, reasons, photos, decision, fixed by, when) → packed (who, when) → dispatched. Actions: reprint taffeta / sticker for this unit, open rework round. Reached by search, scanner input or any unit code link. `GET /units/:code`.

### 4.3 Car item: `/cars/[id]`
Header: brand model · size · line · barcode, active switch, Edit. Stats (range): mats made, in WIP, in stock (packed not dispatched), rework rate, FPY, average cycle time. Lists: active batches (link), recent completed batches. Slice C adds a BOM panel and cost per mat.

### 4.4 Roll / lot: `/stock/rolls/[id]` (becomes a material lot in Slice C)
Header: roll code, colour, remaining / total m, low badge, active. Batches that used it (link, mats, date). Adjustments history (from audit). Slice C: consumption ledger entries and FIFO position.

### 4.5 Rework round
No separate page needed: the round appears inline on the **unit page** (§4.2), deep-linkable as `/units/[code]#round-2`. The `/rework` page gets a History tab (N6) whose rows open that anchor. The decision card stays the action surface.

---

## 5. Proposed slices

Ordered. Each is meant to fit in 1–2 agent sessions. **Before Slice C** = U0, U1, U2, R1. **Parallel to or after Slice C** = U3, R2.

### U0 — Trust fixes (before everything; ~½–1 session)
D1 (active_workers), C3 (IST timezone end to end), D2 + D3 (reports from scan facts), D4 (good/written-off counts), C5, P2 (indexes migration), G4 (role-gate admin reads + enrollment). These are small, mostly backend, and make every later screen show correct numbers.

### U1 — Navigation & entity pages (2 sessions)
L1 (whole-row click + hover in `DataTable`), N2 (`WorkerLink`, API adds ids), N1 + W1 (Worker page + edit/deactivate/reset PIN endpoints), N3 (Unit page), N7, N8 (breadcrumbs/back), N10 (mobile batch fetch by id), G5 (Activity tab, reusing `audit_log`).

### U2 — Lists, search & attention (1–2 sessions)
L3 + P1 (paginated `/batches` with filters), L2 (search/sort/filter in the URL), G1 (⌘K + `/search`, scanner-friendly), G2 (attention inbox: needs E1 for "stuck", so ship a v1 using last-scan time), L4, L5, L7 (CSV).

### R1 — Events + Reports v2 (2 sessions; before Slice C so material reports can reuse it)
E1 `batch_events` (migration + writes in every transition + backfill), D5, D6, W5 (short-cut confirm + reasons). Reports tabs Overview / Workers / Quality with R1, R2, R4, R5, R7, R8, R9, R10, R12. Worker page output panels.

### U3 — Admin corrections & worker app polish (1–2 sessions; can run alongside Slice C)
W2 (edit/cancel batch), W3 (release claim), W4 (bulk reassign from worker page), W7 (sticker print on detail + unit reprint), C1 + C2 (token violations + glossary), M2 (honest offline copy), M3 (all copy into `strings.ts`), M4, M5, W8.

### R2 — Worker self-view & earnings (after Slice C, with Slice D)
M1 ("My work" card + `/worker/me/summary`), R13 earnings + wage sheet print, R6 quota adherence history, R14 material cost per mat (needs Slice C data), W6 dispatch (once Q9 answered), M2 offline scan queue (L).

---

## 6. Open questions for the owner

1. **Language:** Hindi, Gujarati, or both for the worker app? Can every worker read numbers and car model names in English? (decides M3/M4)
2. **Packing split:** do packers ever share a batch with quotas, or is packing always open? (W4 packing card)
3. **Supervisors:** who are they, and what must they *not* do (delete or cancel batches, see wages, reset PINs)? (G3)
4. **Wages:** (a) piece rate per size or per item, or flat per station? (b) Is a written-off mat paid? (c) Is a reworked mat paid once or docked? (D7, R13)
5. **What is "stuck"?** How many hours with no progress before a batch should alert you, per phase? (R4, G2)
6. **Due dates:** do batches come from customer orders with a delivery date? Should batches carry customer and due date? (R11)
7. **Attendance:** is there a shift or attendance record? Mats/hour is approximate without it. Is first-scan → last-scan good enough? (R5)
8. **Cancel policy:** once cutting has started, can a batch be cancelled? What happens to cut pieces: written off, or kept as spare stock? (W2)
9. **Dispatch:** how do mats leave the stockyard (per customer, per challan, by barcode count)? Should RPS track it? (W6)
10. **Worker visibility:** should workers see their ₹ estimate on the phone, or only mat counts? Should they see co-workers' output? (M1)
11. **Short cuts:** what are the real reasons cutters come up short (roll ended, flaw, miscount)? We'd like a fixed reason list for all three actions. (W5, R9)
