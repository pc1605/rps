# Decision Log (ADR-style, append-only)

Each entry: **Decision · Why · Consequences · Status**. Check here before proposing a "simpler" alternative — several were
already argued with the factory owner.

### D01 — Go/Fiber + Postgres backend, Next.js admin, Expo mobile (Week 1)
Developer is an RN/TS dev; Go gives a small fast API binary; Postgres for transactional integrity (claims, counters, audit).
Consequence: JSON types duplicated 3× — `packages/shared` is a standing TODO.

### D02 — Default-deny Guard, `/healthz` outside it (Week 1)
Everything under `/api/v1` needs a token unless whitelisted. Unknown paths → 401 not 404 (no route enumeration). Healthz public for uptime checks.

### D03 — Units created at batch creation (Hard Rule 18)
All `batch_units` rows exist from creation so labels can print any time and per-unit attribution has a home. Identity is born in the DB, attached physically at stitching.

### D04 — Workers use their own phones; phone = identity (Week 3)
One-time enrollment → 30-day token; no daily login; no shared tablets. QR is for enrollment only (a QR *badge login* was rated "maybe never").
Hardening (is_active check, one-time codes, rate limit) deferred to pre-rollout (§3).

### D05 — Scan-per-mat at stitching and packing; tap at cutting (Week 6–8)
Labels don't exist on anything before stitching, so cutting is batch-level; the stitcher attaches the label and scans it; the packer scans to verify.
Matches the original spec ("cutting: scans QR *or selects batch from app*"; packing: per-unit scan). Replaced the interim bulk-mark and the typed stitching quantity (scans *are* the count).

### D06 — PDF is the print pipeline (Week 6)
Labels generated client-side (jsPDF + qrcode) as print-ready PDFs; the OS prints them to whatever printer arrives. No ESC/POS/raw printer code. Only dimension constants change with hardware.

### D07 — Cutting exclusive; stitching/packing joinable multi-worker (Week 8)
Reality: several stitchers share a batch, each completing whole mats. Two partial unique indexes on `phase_logs`. Rejected: `piece_groups` (left/right split within a mat) — owner confirmed whole-mat division.

### D08 — Rejected: quantity *reservation* by workers (Week 8)
Workers choosing "I'll take 6" creates stale commitments and stuck units; the pile is the queue, the scan is the claim. Superseded partly by D10 (admin-set quotas are a different thing: caps set by the planner, not predictions by workers).

### D09 — Pull queue → admin assignment gate for stitching (post-demo, Sept 2026)
Owner: with an open list, stitchers cherry-pick small/easy car mats. Cutting-complete parks the batch (`awaiting_assignment`); only admin assignment releases it; stitchers see only their assigned batches. "Assigned = private" rule applies to any phase. The pull argument (self-balancing) assumed uniform work — it isn't.

### D10 — Strict per-head quotas, count-based, not unit-based (Sept 2026)
Owner: "8 by Surya, 2 by Raj", enforced. Implemented as `target_qty` caps checked at scan; must sum to batch quantity; reassignment = edit numbers with floor = done count. Rejected unit-level pre-assignment: it forces sorting the label strip by person and breaks when someone grabs the wrong label.

### D11 — Taffeta prints at assignment; stickers print at packing entry (Sept 2026)
"Each stage's labels print when work arrives at that stage." Owner wants mats + labels to travel together to the stitcher.

### D12 — Packing stickers unique per mat, strip stays at the station (Sept 2026)
Owner rejected identical per-batch stickers ("full details same as inner"). Rework concern ("sticker must travel with the mat") resolved: the strip is a station artifact; a reworked mat's sticker waits on the strip; per-unit reprint as fallback; kiosk print station only if a printer sits at packing.

### D13 — Rework routes to the stitcher who stitched the mat (designed, Slice B)
`stitched_by` gives automatic accountability. Photo taken by the packer at flagging (owner's wording "cutter" to be confirmed).

### D14 — Realtime WebSocket and AI agent cut from v1
Polling (5 s stats / 15 s queues) is fine at factory scale. First real realtime use case would be per-scan sticker printing.

### D15 — Private distribution, no app stores
Direct APK now; EAS Build/Update after deploy. Auth is the access control. iOS not needed (workers are on Android; owner uses the web).

### D16 — QR enrollment (Sept 2026)
`RPS-ENROLL:<badge>` shown at creation and any time from the Workers list; phone scans it. Typed code remains as fallback. Temporary: re-shows the permanent badge; §3 swaps to one-time expiring codes at the same endpoint.

### D17 — Phase filter lives in the sidebar, not page tabs (Sept 2026)
Persistent sub-nav with live counts doubles as the status board; `?phase=` query param avoids clashing with `/batches/[id]`.

### D18 — Flat car items over separate products table (Sept 2026)
Floor mats are modeled directly as flat items on `car_models` (`brand_id`, `name`, `size_class`, `product_line_id`, `barcode`, `is_active`) rather than an abstract many-to-many product hierarchy. Barcodes live directly on the row, either entered manually or auto-generated via sequence `car_barcode_seq` with Luhn check digits (12-digit scanner-safe). Eliminates joins and keeps catalog operations fast.

### D19 — Short-cut policy: Admin decides (split / reduce / recut) (Sept 2026)
When a cutter completes a batch with `cut_qty < quantity`, the decision to adjust plans belongs to the admin, not the cutter. The batch pauses in `awaiting_assignment` with an amber short-cut banner. Admin has three explicit actions:
1. `split`: batch quantity reduced to cut_qty; remainder batch created for remaining units with `parent_batch_id`.
2. `reduce`: batch quantity clamped to cut_qty; un-cut units marked `cancelled`; `short_reason` logged.
3. `recut`: cutting phase re-opened so a cutter can complete the shortfall.

### D20 — Strict per-head quotas enforced at scan (Sept 2026)
Stitcher quotas on `batch_assignments` (`target_qty`) are strictly validated on every scan. The server increments attribution and rejects scans beyond `target_qty` with 409 `quota_reached`. Guarantees piece-rate equity across workers and eliminates disputes.

### D21 — Single formatter policy: Prettier for formatting, Biome for linting (Sept 2026)
Biome handles high-speed AST linting (`pnpm lint`). Prettier is the single authoritative source of truth for code formatting (`pnpm format:check` / `pnpm format`). Prevents style conflicts and formatting fights across editors and git hooks.

### D22 — `@rps/shared` package for cross-workspace truth (Sept 2026)
Shared TypeScript package (`packages/shared/`) contains phase labels, status labels, size maps, and shared domain constants. Resolves D01's duplicated constants between web, mobile, and documentation.

### D23 — Packer photographs rework defects (Oct 2026)
**Decision**: The packer captures 1–3 photos using their phone camera when flagging a unit for rework.
**Why**: Visual evidence prevents finger-pointing and disputes between stitchers and packers about the origin and severity of the defect.
**Consequences**: Multipart upload required on `/worker/units/:code/rework`; server saves files to disk; images displayed in mobile and admin rework views.
**Status**: Built & Verified (Slice B).

### D24 — Reason-based rework routing (Oct 2026)
**Decision**: Rework routing depends strictly on defect category:
- Stitching faults, stains, and other minor issues route directly to the stitcher who originally stitched the mat (`bu.stitched_by`).
- Cutting faults and raw material defects route directly to admin oversight.
**Why**: Stitchers can quickly repair sewing flaws, but cannot fix cut geometry or defective cloth rolls. Sending cloth flaws to stitchers wastes labor.
**Consequences**: Round 1 automatically partitions queues; stitchers only receive fixable rework.
**Status**: Built & Verified (Slice B).

### D25 — Automatic escalation to admin on Round 2 (Oct 2026)
**Decision**: Any mat returned to rework for a second round (`round >= 2`) automatically bypasses the stitcher queue and routes to admin.
**Why**: If a mat remains defective after stitcher rework, repeated stitcher handoffs cause infinite loops and worker frustration. Management intervention is required.
**Consequences**: Admin makes executive call on repeat failures (`to_stitcher`, `recut`, or `write_off`).
**Status**: Built & Verified (Slice B).

### D26 — Recut creates a new 1-mat batch (Oct 2026)
**Decision**: When admin chooses `recut` for an irreparable unit, the defective unit is written off (`status = 'defective'`) and a new 1-mat batch is spawned for the same car model.
**Why**: Keeps batch accounting and quota mathematics clean without reopening cutting on an active packing batch. The replacement unit goes through the standard cutting → stitching → packing pipeline with clean attribution.
**Consequences**: Remainder recut batch is tracked with its own batch code; audit history links the replacement.
**Status**: Built & Verified (Slice B).

### D27 — Signed photo URLs with HMAC-SHA256 (Oct 2026)
**Decision**: Rework photo files are served via expiring HMAC-SHA256 signed URLs (`/api/v1/files/rework/:name?exp=<unix>&sig=<hex>`) without Bearer token headers.
**Why**: Mobile `<Image source={{uri}}>` and web `<img src>` struggle to send custom `Authorization: Bearer <token>` headers across native caching layers and image libraries. Public signed URLs allow native image caching while keeping storage private against tampering and unauthenticated scraping.
**Consequences**: Secret key `FILE_URL_SECRET` configures signing and constant-time verification; URLs expire after `FILE_URL_TTL_MINUTES` (default 60m).
**Status**: Built & Verified (Slice B).

### D28 — Typed batch events for time-based reports (Oct 2026)
**Decision**: Every batch transition writes a `batch_events` row (kind, from/to phase and status, actor, data) in the same tx. Reports take time from events and count mats from unit scans.
**Why**: Phase entry/exit times were scattered across `phase_logs`, `updated_at` and audit JSON; ageing, stuck, cycle time and "completed today" were approximations (audit E1, D5).
**Consequences**: Migration 016 backfills existing batches (approximate, `data.backfill`); `backfill_batch_events()` also runs after the demo seed. U3 writes `cancelled` / `edited` / `claim_released`.
**Status**: Built (R1).

### D29 — Stuck = no activity past a per-stage threshold (Oct 2026)
**Decision**: A live batch is stuck when its last activity (event, scan, claim, rework step) is older than `app_settings.stuck_hours[stage]` — defaults cutting 24 h, ready for stitching 24 h, stitching 48 h, packing 48 h; editable on Reports.
**Why**: Owner question 5 in the audit; defaults approved in R1.
**Status**: Built (R1).

### D30 — Short-cut actions need a reason (Oct 2026)
**Decision**: Split, Reduce and Re-cut are confirmed in a dialog and require a reason code (+ note for Other).
**Why**: Audit W5 — actions ran with one tap, and only Reduce had an (optional) reason, so short-cut frequency by cause was unknowable.
**Status**: Built (R1). Older resolutions show as "Not recorded".

### D31 — Assignment UI is stitching only (Nov 2026)
**Decision**: The assign panel, load view and hand-over exist for stitching only. Packing stays an open queue with no
assignment UI (the backend still accepts packing assignments; nothing in the admin sets them).
**Why**: Owner (U3): assigning packers would make the process more complicated.
**Status**: Built (U3).

### D32 — Stitching assignment defaults and hand-over (Nov 2026)
**Decision**: Assign from the Ready list in a side panel (not a board). Fixed share each is the default, shared pile an
option. Taffeta labels print at the first assignment (remembered checkbox). An absent or stuck stitcher's remaining
mats are handed over: they keep a target equal to what they've stitched (removed if 0), the new stitcher gets the rest;
on the worker page one person takes everything by default, with a per-batch override. Load "open mats" in a shared-pile
batch counts every unstitched mat for each assignee.
**Why**: Owner answers to the U3 hand-off questions (Nov 2026); answers the audit question "absent stitcher's quota".
**Status**: Built (U3).

### D33 — "Waiting" counts from when cutting finished (Nov 2026)
**Decision**: The Ready list's waiting time (`ready_since`) is the latest `cut_completed` event. Resolving a short cut or
clearing a stitching assignment doesn't restart it; a re-cut does (cutting finishes again).
**Why**: Owner (U3): a batch held up by a short cut has really been waiting since cutting ended.
**Status**: Built (U3).

### D34 — Edit a batch only before cutting starts (Nov 2026)
**Decision**: Car item, quantity, roll and notes can be edited while the batch is `cutting/pending` (nobody holds the
claim). Once some mats are cut (a re-cut after a short cut, or reused spares) the car is fixed and the quantity must
stay above `cut_qty`. Quantity changes add / delete the highest-numbered units. `edited` event with before/after.
**Why**: Audit gap (no way to fix a wrong entry); after cutting, the cut mats and consumed material make an edit a lie.
**Status**: Built (U3).

### D35 — Cancel keeps cut work as spare stock (Nov 2026)
**Decision**: Owner and supervisors may cancel a batch until its first mat is packed. Stitched and cut-unstitched mats
become `spare` (kept on the cancelled batch, codes kept); never-cut units are deleted; mats in open rework are written
off (not kept as spares); open logs close, assignments are cleared, consumed materials stay consumed. The admin sees
the outcome before confirming (`/cancel-preview`), and gives a reason.
**Why**: Owner answers for U3 (Nov 2026): cut/stitched mats are real stock, not waste; rework mats are written off
(owner confirmed the default). Answers the audit question "who may cancel a batch after cutting".
**Status**: Built (U3).

### D36 — Spares are reused on New batch for the exact same car item (Nov 2026)
**Decision**: New batch offers spares of exactly the same car item (car_models row = model + product line). Used
spares move into the new batch as units 1..k, already cut (`cut_qty = k`, so the cutter cuts and the engine consumes
less). Unstitched spares get new codes; stitched spares keep theirs, count as stitched (`prestitched`) and keep their
stitcher's credit without that stitcher being assigned. Stitching quotas total the mats still to stitch. Spares covering
the whole batch skip cutting; all stitched → straight to packing. Spares can be written off from Stock → Spare mats.
**Why**: Owner answers for U3; exact match is the owner-confirmed default (colour / material differs across lines).
Straight-to-packing confirmed by the owner when the plan was approved.
**Status**: Built (U3).

### D37 — Releasing a cutting claim deletes the open log (Nov 2026)
**Decision**: The admin (timeline) or the cutter holding it (phone, before Complete) can release a cutting claim; the
batch returns to `cutting/pending` and the open cutting log is deleted rather than closed with 0, so cycle-time reports
stay clean. The `claim_released` event + audit keep who held it and since when.
**Why**: Owner approved (U3 plan). A stuck claim otherwise blocked the batch for every other cutter.
**Status**: Built (U3).

### D38 — Undo scan: admin only, only until the next stage starts (Nov 2026)
**Decision**: Owner/supervisor can undo a mat's latest stitch or pack scan from the admin, with a reason. If that scan
finished the stage, the batch moves back (and the logs it closed reopen) only while nothing happened in the next stage
(no packer joined, nothing packed; nothing dispatched after completion). Refused for mats in rework, fixed in rework
after the stitch, written off, spare, or prestitched. Workers can't undo.
**Why**: Owner answers for U3; "refuse once the next stage started" is the owner-confirmed default.
**Status**: Built (U3).

### D39 — "My work" on the phone, counts only (Nov 2026)
**Decision**: The phone home shows the worker's own output: today and this week (from Monday, factory time) at their
station; stitchers also see mats that came back for rework this week and how many wait for them; packers how many they
sent to rework. No money until Slice D.
**Why**: Owner (U3); audit question "should workers see their own output".
**Status**: Built (U3).
