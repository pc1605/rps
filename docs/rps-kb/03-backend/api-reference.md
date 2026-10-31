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
| GET | `/batches` | all batches, newest first (List). Roll-ups `units_total, units_packed, units_stitched, units_written_off, rework_open`, plus `active_workers` (open logs at the current phase) |
| POST | `/batches` | `{car_model_id, quantity, roll_id?, notes?}` → 201 Batch (units created) |
| GET | `/batches/stats` | `BatchStats` (`@rps/shared`): `{in_cutting, awaiting_assignment, in_stitching, in_packing, completed_today, total_active, rework_open, rework_needs_decision}`. `completed_today` = factory day (`FACTORY_TZ`) |
| GET | `/batches/:id` | BatchDetail: `units[]`, `timeline[]`, `assignments[]`, `cut_qty`, `parent_batch_id`, `short_reason`; same roll-ups as List, computed server-side |
| PUT | `/batches/:id/assignments` | `{phase:"stitching", assignments:[{worker_id, target_qty?}, …]}`. Empty list clears. Operates the gate for stitching. 400 on quota rule violations |
| POST | `/batches/:id/resolve-short` | `{action:"split"|"reduce"|"recut", reason?}`. Resolves cutter short cuts. Split creates linked remainder batch; reduce cancels un-cut units; recut re-opens cutting |
| POST | `/batches/:id/stickers-printed` | stamps `stickers_printed_at = now()` |
| GET | `/rework` | query params `?status=open|all&route=admin|stitcher`. Returns `ReworkEntry[]` with signed photo URLs |
| POST | `/rework/:id/decide` | `{decision: "to_stitcher"|"recut"|"write_off", note?}`. Directs admin-routed rework items. Recut spawns new 1-mat batch |
| GET/POST | `/workers` | list (no badge exposed) / create `{name, station, pin, phone?}` → 201 with `badge_token` **once** |
| GET | `/workers/:id/enrollment` | `{badge_token}` for re-showing the QR (admin) |
| GET/POST/PATCH | `/stock/rolls`, `/stock/rolls/:id` | rolls with `is_low`, `batch_count`; PATCH `{remaining_meters?, is_active?}` |
| GET | `/stock/finished` | packed units grouped by model |
| GET | `/reports/workers?from=YYYY-MM-DD&to=YYYY-MM-DD` | dates are factory days (`FACTORY_TZ`, default Asia/Kolkata), `to` inclusive; default last 7 days incl. today; per worker `batches_done, pieces_done, avg_duration_secs, currently_working` (open claim, window-independent); sorted pieces desc. Role-guarded |
| PATCH | `/car-models/:id` | also `consumption_group_id` (active group only); tx + audit. List returns `consumption_group_id`, `consumption_group_name` |

### Materials (C1c · `internal/materials` · design `02-domain/materials.md`)
Quantities are JSON numbers with ≤ 3 decimals (money ≤ 2), parsed exactly (no float). Errors: 400 `bad_request`,
404 `not_found`, 409 `duplicate` / `unit_locked` / `has_active_variants` / `variants_in_use` / `lot_has_consumption` /
`group_in_use` / `group_is_default`. Every mutation: tx + audit row; every lot quantity change is a movement.

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/materials/types` | rows add `stock_remaining`, `active_lots`, `is_low`. POST `{code, name, unit, has_variants?, min_level?, sort?, is_active?}` (code upper-cased) |
| PATCH | `/materials/types/:id` | same fields (`min_level: null` clears). 409 `unit_locked` once the type has movements; `has_variants:false` → 409 `has_active_variants` / `variants_in_use` |
| GET/POST | `/materials/types/:id/variants` | `{name, specs (object), is_active?}`; 400 if the type has no variants |
| PATCH | `/materials/variants/:id` | `{name?, specs?, is_active?}` |
| GET | `/materials/lots?type_id&active&low` | lots with type, variant, colour, qty, unit, cost, supplier, `last_movement_at`. `low=true` = lots of types below `min_level` |
| POST | `/materials/lots` | receive `{material_type_id, variant_id (iff has_variants), lot_code, color, qty > 0, unit_cost?, supplier?, note?}` → lot + `receive` movement |
| POST | `/materials/lots/:id/adjust` | `{new_remaining ≥ 0, reason}` → `adjust` for the difference (400 if no change) |
| POST | `/materials/lots/:id/waste` · `/return` | `{qty > 0, reason}` → `waste` (−, ≤ remaining) / `return` (+) |
| PATCH | `/materials/lots/:id` | `is_active, color, supplier, note, unit_cost` (null clears); `material_type_id` / `variant_id` only before any consume/waste/return (else 409 `lot_has_consumption`) — opening movements move along |
| GET | `/materials/movements?lot_id\|type_id\|batch_id&from&to&limit&cursor` | ledger newest first with lot, type, variant, batch code, actor names; `{items, next_cursor?}` (keyset; limit ≤ 200, default 50); from/to = factory days |
| GET/POST | `/consumption-groups` | rows add `car_count`. `{name, sort?, is_active?, default_for_size?}` — name and size default unique |
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

