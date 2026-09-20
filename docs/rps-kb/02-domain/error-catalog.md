# Error Catalog

Response shape: `{"code": "<snake>", "error": "<user-facing message>"}`. Sentinels: `internal/batch/service.go`;
mapping: `handler.go` (`transitionResponse` for start/complete; dedicated switch in the `ScanUnit` handler).

| Sentinel | Message | HTTP / code | When |
|---|---|---|---|
| `ErrNotFound` | batch not found | 404 `not_found` | unknown batch id |
| `ErrInvalidInput` (wrapped) | e.g. "stitching completes automatically when all units are scanned", "quotas total 9 but batch has 10 mats", "Surya has already done 5 — target can't be lower", "… reduce their target instead of removing them" | 400 | validation |
| `ErrWrongPhase` | this batch is not at your station right now | 409 `wrong_phase` | phase mismatch (scan handler: "this batch is not at your station's phase") |
| `ErrAlreadyStarted` | this batch has already been started | 409 `already_started` | cutting claim exists (same or other cutter) |
| `ErrNotStarted` | this batch is not active yet — start or join it first | 409 `not_started` | complete on pending; scan without join (scan handler: "join this batch before scanning") |
| `ErrNotYours` | this batch was started by another worker | 403 | cutter completing someone else's claim |
| `ErrNotAssigned` | this batch is assigned to other workers | 403 `not_assigned` | join on an assigned phase by a non-assignee |
| `ErrQuotaReached` | your share of this batch is complete (n/N) | 409 `quota_reached` | scan beyond `target_qty` |
| `ErrUnitNotFound` | unknown QR — not an RPS unit label | 404 `unit_not_found` | scan of unknown code |
| Guard | missing bearer token / invalid token | 401 | any protected route, including unknown paths under `/api/v1` |
| Role guard | forbidden | 403 | worker token on admin route; non-owner/supervisor on reports |

Worker login always returns the vague `invalid badge or pin` (401) whether the badge exists or not — intentional.

Mobile mapping: green ok · amber `already_done` · blue `quota_reached` · red everything else (scanner flashes);
`Alert` dialogs on the batch screen for start/complete errors.
