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

## Admin (owner/supervisor)
| Method | Path | Notes |
|---|---|---|
| GET | `/me` | current user |
| GET | `/car-models` · `/rolls` | reference lists |
| GET | `/batches` | all batches, newest first (List) |
| POST | `/batches` | `{car_model_id, quantity, roll_id?, notes?}` → 201 Batch (units created) |
| GET | `/batches/stats` | `{in_cutting, awaiting_assignment, in_stitching, in_packing, completed_today, total_active}` |
| GET | `/batches/:id` | BatchDetail: `units[]`, `timeline[]`, `assignments[]` |
| PUT | `/batches/:id/assignments` | `{phase:"stitching", assignments:[{worker_id, target_qty?}, …]}`. Empty list clears. Operates the gate for stitching. 400 on quota rule violations |
| POST | `/batches/:id/stickers-printed` | stamps `stickers_printed_at` |
| GET/POST | `/workers` | list (no badge exposed) / create `{name, station, pin, phone?}` → 201 with `badge_token` **once** |
| GET | `/workers/:id/enrollment` | `{badge_token}` for re-showing the QR (admin). §3 will swap to one-time codes |
| GET/POST/PATCH | `/stock/rolls`, `/stock/rolls/:id` | rolls with `is_low`, `batch_count`; PATCH `{remaining_meters?, is_active?}` |
| GET | `/stock/finished` | packed units grouped by model |
| GET | `/reports/workers?from=YYYY-MM-DD&to=YYYY-MM-DD` | default last 7 days; per worker `batches_done, pieces_done, avg_duration_secs, currently_working` (open claim, window-independent); sorted pieces desc. Role-guarded |

## Worker
| Method | Path | Notes |
|---|---|---|
| GET | `/worker/me` | profile (used by cold-start `restore()`) |
| GET | `/worker/batches` | my queue (ListByPhase for my station; visibility rules apply). Fields in `02-domain/work-model.md §6` |
| POST | `/worker/batches/:id/start` | cutting: exclusive claim; stitching/packing: join (idempotent). 403 `not_assigned` if assigned elsewhere |
| POST | `/worker/batches/:id/complete` | `{quantity_completed, notes?}` — **cutting only**; 400 for stitching/packing |
| POST | `/worker/units/scan` | `{unit_code}` → `ScanResult{unit_code, batch_code, phase, already_done, done_count, total_units, phase_completed, batch_completed}`. 404 unit_not_found · 409 wrong_phase / not_started / quota_reached |

## Scan endpoint behaviour by station
- cutter → 409 wrong_phase (cutters don't scan).
- stitcher on a batch at stitching, joined, under quota → marks `stitched_by/at`; last one → phase_completed.
- packer on a batch at packing, joined, under quota → marks packed; last one → batch_completed.
- Already done → 200 `already_done:true` (no writes) regardless of phase/join state.
