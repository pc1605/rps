# Gotchas — every one of these cost real time

## Shell / tooling
- The tool shell is `sh`, not bash: **no brace expansion** (`mkdir dir/{a,b}` makes a literal `{a,b}` dir). Zsh needs `"*:S"` quoted in logcat filters.
- `.env` for migrations is at the **repo root**, not `apps/backend`. `source: no such file` / `URL cannot be empty` = wrong cwd.
- golang-migrate leaves a **dirty** version after a half-failed migration: `force <prev>` then fix and `up`.
- pnpm blocks postinstall scripts: `[ERR_PNPM_IGNORED_BUILDS]` → `pnpm approve-builds` (select) → `pnpm install`. Hoisted layout ⇒ packages are in the **root** `node_modules`.

## Postgres
- Check enum type names before writing migrations (`batch_phase`, `batch_status`, `worker_station`); guessed names failed twice.
- `batch_code_counters` columns are `(year, last_number)`; `workers.created_by` is NOT NULL (seed scripts must set it).
- Enum values can't be dropped; `ADD VALUE` can't be used by the same transaction that adds it.
- `LEFT JOIN` + `BOOL_OR(x IS NULL)` is true when there are **no** rows (the joined row is all-NULL) — guard with `AND id IS NOT NULL` or use `EXISTS`.
- Filtering a join by date also filters "is currently working" — compute that with an independent `EXISTS`.

## Go / pgx
- SELECT columns ≠ Scan targets → runtime error "number of field descriptions must equal number of destinations", or **silently swapped values when types match** (happened in GetStats). Align vertically.
- Nullable columns → pointer fields (`*time.Time`, `*int`, `*string`).
- Guards that must reject early (e.g. "packing completes automatically") must be the **first** thing in the function, not after the work is done.
- Handlers swallow errors into a generic 500 — always `log.Error().Err(err)` first.
- A pasted line landing inside a `Scan(...)` argument list produces `expected '==', found '='` two lines later.

## Fiber
- CORS `AllowMethods` must include every verb the web app uses (PUT was missing → preflight blocked). Native apps don't hit CORS, so Postman/mobile won't reveal it.
- Guard on the `/api/v1` group runs before route matching → unknown paths give 401, not 404 (intentional).

## Next.js / React
- TanStack v5: `isLoading = isPending && isFetching`. A **disabled** query or an **errored** query has `isLoading === false` with no data → empty-state flash. Branch on `isPending` and add an error branch.
- `react-hooks/set-state-in-effect` lint: don't sync props into state in effects; remount with `key` or load in the dialog's `onOpenChange`.
- `useSearchParams` needs a `<Suspense>` boundary.
- shadcn `Tabs` looked cramped with five long labels → moved the phase filter to the sidebar sub-nav.

## Expo / RN
- Expo Go is broken for this project — use the dev build only.
- `EXPO_PUBLIC_*` is baked at build time; `.env` edits need `expo run:android` (dev) or a release rebuild for phones.
- `10.0.2.2` is emulator-only. Phones need LAN IP, hotspot IP (`10.42.0.1`), or ngrok. Check `http://<host>:8080/healthz` in the phone browser first. Home routers with AP/client isolation block phone→laptop.
- Toggling `onBarcodeScanned` between a function and `undefined` **restarts the camera** (black preview each scan). Keep the handler stable; gate with a ref.
- Piggybacking a new feedback case on an existing kind shows the wrong header — give each case its own `kind`.
- Theme has no `text.caption`; use `text.label`.
- Release APK on a phone ≠ the code you just edited — check the bundled URL with `unzip -p … | strings | grep api/v1`.
- `adb install` with multiple devices needs `-s <serial>`; signature mismatch ⇒ uninstall first.
- Emulator webcam/virtual-scene camera works for QR tests; scanning PDFs off a laptop screen works fine.

## Auth / product
- Enrollment badge tokens are long — never type them; scan the QR or paste. Fast 401s (<1 ms) on `/worker/login` mean badge-not-found; ~100–200 ms means bcrypt ran (badge found, PIN wrong).
- All dev workers use PIN 1234.
