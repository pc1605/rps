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
