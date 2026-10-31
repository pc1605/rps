# API Reference

Base: `http://<host>:8080/api/v1`. Envelope `{"data": …}`. Errors: see `02-domain/error-catalog.md`.
Auth: `Authorization: Bearer <token>`; admin token for admin routes, worker token for `/worker/*`.

## Public
| Method | Path | Body → Response |
|---|---|---|
| GET | `/healthz` (root, not under /api/v1) | `{"status":"ok"}` |
| POST | `/auth/login` | `{email,password}` → `{user, tokens{access_token, refresh_token}}` |
| POST | `/auth/refresh` | `{refresh_token}` → tokens |
| POST | `/worker/login` | `{badge_token, pin, device_id?}` → `{worker, tokens{access_token}}` (30d). Always 401 `invalid badge or pin` on failure |
| GET | `/files/rework/:name?exp=<unix>&sig=<hmac>` | Public signed URL for rework photos. Validates HMAC-SHA256 signature against `FILE_URL_SECRET`. 403 `invalid_signature` if expired or tampered |

## Admin (requires admin token)
| Method | Path | Notes |
|---|---|---|
| GET | `/me` | current user |
| GET | `/car-models` | flat items: brand, name, size_class, pieces_per_set, line_code, line_name, barcode, is_active |
| POST | `/car-models` | create flat item `{brand_id, name, size_class, pieces_per_set, product_line_id, barcode?}` (auto-generates 12-digit barcode if omitted) |
| PATCH | `/car-models/:id` | update flat item `{brand_id, name, size_class, pieces_per_set, product_line_id, barcode?, is_active?}` |
| GET/POST | `/car-brands` | list brands / create brand `{name}` |
| GET | `/product-lines` | list active product lines (`REX-R`, `REX-87`, `PVC-18`, `PVC-21`) |
| GET | `/rolls` | raw materials roll list |
| GET | `/batches?view&q&car_model_id&product_line_id&from&to&has_rework&short&sort&order&page&limit` | **U2**: `{items, total, page, limit}`. `view` = cutting · ready · stitching · packing · completed (sidebar tabs); `q` matches batch code, car (brand + model), product line name or exact barcode (LIKE-escaped); from/to = created, factory days inclusive; `sort` created · code · quantity · phase · car (default created desc); `limit` 1–200 (default 50). Items carry roll-ups `units_total, units_packed, units_stitched, units_written_off, rework_open` + `active_workers`. 400 on bad params |
| POST | `/batches` | `{car_model_id, quantity, roll_id?, notes?}` → 201 Batch (units created) |
| GET | `/batches/stats` | `BatchStats` (`@rps/shared`): `{in_cutting, awaiting_assignment, in_stitching, in_packing, completed_today, total_active, rework_open, rework_needs_decision, material_shortfalls_open, low_stock_types, working: {phase: [names]}}`. `completed_today` = factory day (`FACTORY_TZ`) |
| GET | `/batches/:id` | BatchDetail: `units[]`, `timeline[]`, `assignments[]`, `cut_qty`, `parent_batch_id`, `short_reason`; same roll-ups as List, computed server-side |
| PUT | `/batches/:id/assignments` | `{phase:"stitching", assignments:[{worker_id, target_qty?}, …]}`. Empty list clears. Operates the gate for stitching. 400 on quota rule violations |
| POST | `/batches/:id/resolve-short` | `{action:"split"|"reduce"|"recut", reason, note?}` — `reason` **required** (R1/W5), a `SHORT_REASON_LABEL` code: `roll_ran_out, material_defect, machine_issue, cutter_error, order_changed, other`; `note` required for `other`. Split creates a linked remainder batch; reduce **deletes** the un-cut units; recut re-opens cutting. Writes a `short_resolved` event |
| POST | `/batches/:id/stickers-printed` | stamps `stickers_printed_at = now()` |
| GET | `/rework` | query params `?status=open|all&route=admin|stitcher`. Returns `ReworkEntry[]` with signed photo URLs |
| POST | `/rework/:id/decide` | `{decision: "to_stitcher"|"recut"|"write_off", note?}`. Directs admin-routed rework items. Recut spawns new 1-mat batch |
| GET/POST | `/workers` | list (no badge exposed) / create `{name, station, pin, phone?}` → 201 with `badge_token` **once** |
| GET | `/workers/:id/enrollment` | `{badge_token}` for re-showing the QR (admin) |
| GET | `/workers/:id` | **worker page (U1)**: profile + `open_claims` (batch, phase, since, my_done/target), `assigned` (at the batch's current phase, not joined), `open_rework` (rounds on mats they stitched; `awaiting_decision`) |
| GET | `/workers/:id/summary?from&to` | factory days, inclusive (default last 14): `unit` (pieces cut / mats stitched / mats packed), `total`, `today`, `last_7_days`, `mats_per_hour`, `days[]` (mats, first/last, active secs); stitchers `rework_caused {rounds, rate_pct, by_reason}` + `rework_fixed {count, median_turnaround_secs}`; packers `flagged`. Counted from scan facts (`stitched_at`/`packed_at`; cutting `completed_at`) |
| GET | `/workers/:id/history?limit&cursor` | participations newest first (`phase_logs`): batch, item, phase, mats, target, first/last scan, rework caused; keyset `next_cursor` |
| PATCH | `/workers/:id` | `{name?, phone? ("" clears), station?, is_active?}`; station change / deactivation → 409 `worker_busy` while open claims or unfinished quotas. Tx + audit |
| POST | `/workers/:id/reset-pin` | `{pin?}` → `{pin}` returned once (random 4 digits if omitted); never logged; audit says `pin_reset` only |
| GET | `/search?q=` | **U2** header search (q ≥ 2 chars, ≤ 5 per kind): `{q, exact?, hits[{kind: batch·unit·car·worker·lot, id, label, sub}]}`; `exact` = full batch/unit/lot code or barcode (scanner input) |
| GET | `/units/:code` | **unit page**: `{unit (incl. rework rounds + photos), batch, cutting[]}`; 404 `unit_not_found` |
| GET | `/car-models/:id/overview?from&to` | **car page**: item + stats (stitched, packed, rework rounds/rate, first-pass yield in range; WIP, stock now) + active + last 10 completed batches (default range last 30 days) |
| GET | `/materials/lots/:id` | **lot page**: lot + `consumed`, `wasted`, `adjusted`, `returned` + batches that chose it as roll or drew from it |

Ids next to names (U1): units `stitched_by`/`packed_by`; rework entries `flagged_by`, `fixed_by`, `stitcher_id`; a `recut` decision returns `new_batch_id`.
| GET/POST/PATCH | `/stock/rolls`, `/stock/rolls/:id` | rolls with `is_low`, `batch_count`; PATCH `{remaining_meters?, is_active?}` |
| GET | `/stock/finished` | packed units grouped by model |
| GET | `/reports/workers?from=YYYY-MM-DD&to=YYYY-MM-DD` | dates are factory days (`FACTORY_TZ`, default Asia/Kolkata), `to` inclusive; default last 7 days incl. today; per worker `batches_done, pieces_done, avg_duration_secs, currently_working` (open claim, window-independent); sorted pieces desc. Role-guarded |
| GET | `/reports/overview?from&to` | R1. Default last 30 days (max 366). `days[]` (cut from `cut_completed` events, stitched/packed from unit scans), `totals`, `previous` (same length just before), `wip[]` per stage (`cutting, awaiting_assignment, stitching, packing`: batches, mats, `ageing` [<4 h, 4–24 h, 1–3 d, >3 d] since entering the stage, stuck), `stuck_count`, `fpy_packed/fpy_first_pass` + `fpy_weeks[]`, `items[]` (packed per car), `stuck_hours` |
| GET | `/reports/stuck` | live batches whose last activity (newest event, scan, claim or rework step) is older than their stage's threshold; longest idle first |
| GET | `/reports/worker-output?from&to` | default 7 days. Per worker: `mats` (cutters: pieces from completed cutting logs), `days_worked`, `active_secs` (scans: first→last per day; cutters: start→complete), `mats_per_hour` (≥ 15 min), stitchers: `rework_rounds`, quota `target/done/batches` (batches whose stitching completed in range), `currently_open` |
| GET | `/reports/quality?from&to` | default 30 days. Rework rounds, `by_reason`, `by_stitcher` (rounds vs stitched), fixed count + `avg_fix_hours`, `cut_completions`, `short_cuts[]` by action × reason, `losses[]` write-off/recut by car, `loss_by_reason` |
| GET / PUT | `/settings` · `/settings/stuck_hours` | `{stuck_hours: {cutting, awaiting_assignment, stitching, packing}}` hours 1–720 (default 24/24/48/48); PUT tx + audit (`app_setting`) |
| PATCH | `/car-models/:id` | also `consumption_group_id` (active group only); tx + audit. List returns `consumption_group_id`, `consumption_group_name` |

### Materials (C1c · `internal/materials` · design `02-domain/materials.md`)
Quantities are JSON numbers with ≤ 3 decimals (money ≤ 2), parsed exactly (no float). Errors: 400 `bad_request`,
404 `not_found`, 409 `duplicate` / `unit_locked` / `has_active_variants` / `variants_in_use` / `lot_has_consumption` /
`group_in_use` / `group_is_default`. Every mutation: tx + audit row; every lot quantity change is a movement.

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/materials/types` | rows add `stock_remaining`, `active_lots`, `is_low`, `recipe_lines`, `override_cars`, `has_history` (any lot / movement / plan row), `deletable`. POST `{code, name, unit, has_variants?, min_level?, sort?, is_active?}` (code upper-cased; no `sort` = after the last type, MAX + 10) |
| PATCH | `/materials/types/:id` | same fields (`min_level: null` clears). 409 `unit_locked` once the type has movements; `has_variants:false` → 409 `has_active_variants` / `variants_in_use` |
| DELETE | `/materials/types/:id` | 204; only when `deletable` (variants go with it), else 409 `type_in_use` — deactivate instead. tx + audit |
| GET/POST | `/materials/types/:id/variants` | `{name, specs (object), is_active?}`; 400 if the type has no variants |
| PATCH | `/materials/variants/:id` | `{name?, specs?, is_active?}` |
| GET | `/materials/lots?type_id&active&low` | lots with type, variant, colour, qty, unit, cost, supplier, `last_movement_at`. `low=true` = lots of types below `min_level` |
| POST | `/materials/lots` | receive `{material_type_id, variant_id (iff has_variants), lot_code, color, qty > 0, unit_cost?, supplier?, note?}` → lot + `receive` movement |
| POST | `/materials/lots/:id/adjust` | `{new_remaining ≥ 0, reason}` → `adjust` for the difference (400 if no change) |
| POST | `/materials/lots/:id/waste` · `/return` | `{qty > 0, reason}` → `waste` (−, ≤ remaining) / `return` (+) |
| PATCH | `/materials/lots/:id` | `is_active, color, supplier, note, unit_cost` (null clears); `material_type_id` / `variant_id` only before any consume/waste/return (else 409 `lot_has_consumption`) — opening movements move along |
| GET | `/materials/movements?lot_id\|type_id\|batch_id&from&to&limit&cursor` | ledger newest first with lot, type, variant, batch code, actor names; `{items, next_cursor?}` (keyset; limit ≤ 200, default 50); from/to = factory days |
| GET/POST | `/consumption-groups` | rows add `car_count`, `recipe_lines`, `deletable`. `{name, sort?, is_active?, default_for_size?}` — name and size default unique; no `sort` = after the last group (MAX + 10) |
| DELETE | `/consumption-groups/:id` | 204; empty recipe headers go with it. 409 `group_in_use` (cars) · `group_is_default` · `group_has_recipes`. tx + audit |
| PATCH | `/consumption-groups/:id` | same fields (`default_for_size: null` clears). Can't deactivate while cars use it (409 `group_in_use`) or while it's a size default (409 `group_is_default`) |
| GET | `/recipes?product_line_id` | grid: every group with its recipe lines for the line |
| PUT | `/recipes/:product_line_id/:group_id/lines` | body = array `[{material_type_id, variant_id?, qty_per_mat > 0}]`, full replace; creates the recipe row |
| GET/PUT | `/car-models/:id/material-overrides` | body = array, `qty_per_mat ≥ 0` (0 = doesn't use it), full replace |
| GET | `/recipes/resolve?car_model_id&quantity&lot_id?` | **dry run** of the engine (same planner): per type `source, variant, qty_per_mat, need, available, shortfall, draws[]`; no writes |
| GET | `/batches/:id/materials` | plan rows + consume/shortfall movements grouped by cutting completion |

All routes above require an **admin** token (`owner`/`supervisor`); worker tokens get 403 (U0 / G4).

## Worker (requires worker token)
| Method | Path | Notes |
|---|---|---|
| GET | `/worker/me` | profile (used by cold-start `restore()`) |
| GET | `/worker/batches` | my queue (ListByPhase for my station; visibility rules apply). Fields in `02-domain/work-model.md §6` |
| POST | `/worker/batches/:id/start` | cutting: exclusive claim; stitching/packing: join (idempotent). 403 `not_assigned` if assigned elsewhere |
| POST | `/worker/batches/:id/complete` | `{quantity_completed, notes?}` — **cutting only**; 400 for stitching/packing |
| GET | `/worker/units/:code/peek` | Packer inspection before pack/flag. Returns `{unit_code, batch_code, status, batch_phase, batch_status, joined, can_pack, can_rework, reason}` |
| POST | `/worker/units/:code/rework` | Multipart form: `reasons` (`stitching_fault`, `stain`, `cutting_fault`, `material_defect`, `other`), `note?`, `photos` (1-3 images). Flags unit in rework |
| GET | `/worker/batches/:id/materials-needed` | **cutter token only** (else 403 `cutter_only`): for the remaining mats (quantity − cut_qty, while cutting) → per type `type_name, unit, need, lots[{lot_code, color, width, qty}], shortfall`. Read-only |
| GET | `/worker/rework` | Stitcher rework queue: lists open rework items where `route = 'stitcher'` and `stitched_by = worker_id` |
| POST | `/worker/units/scan` | `{unit_code}` → `ScanResult`. Marks stitched / packed, or repairs rework (`rework_fixed: true`). 404 unit_not_found · 409 wrong_phase / not_started / quota_reached / in_rework / written_off / rework_pending_decision · 403 not_your_rework |

## Scan endpoint behaviour by station
- cutter → 409 wrong_phase (cutters don't scan).
- stitcher on normal batch → marks `stitched_by/at`; last one → phase_completed.
- stitcher on rework mat (`status='rework'`) → if `stitched_by == me` and `route='stitcher'` (or admin decided `to_stitcher`), resets unit to pending, closes rework round, returns `rework_fixed: true`. If another stitcher scans → 403 `not_your_rework`. If awaiting admin decision → 409 `rework_pending_decision`.
- packer on normal batch → marks packed; last one → batch_completed.
- packer on rework mat → 409 `in_rework`.
- packer on written-off mat (`status='defective'`) → 409 `written_off`.
- Already done → 200 `already_done:true` (no writes) regardless of phase/join state.

