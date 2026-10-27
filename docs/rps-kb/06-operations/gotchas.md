# Gotchas — every one of these cost real time

## Shell / tooling
- The tool shell is `sh`, not bash: **no brace expansion** (`mkdir dir/{a,b}` makes a literal `{a,b}` dir). Zsh needs `"*:S"` quoted in logcat filters.
- **zsh glob quoting**: In zsh, unquoted globs like `prettier --check apps/**/*.{ts,tsx}` trigger `zsh: no matches found`. Always wrap file patterns in quotes (`"apps/**/*.{ts,tsx}"`).
- **golangci-lint PATH**: The binary typically resides in `$(go env GOPATH)/bin`. If `golangci-lint: command not found`, add `export PATH=$PATH:$(go env GOPATH)/bin` to `.bashrc`/`.zshrc`.
- **Prettier / Biome split**: Biome is strictly used for fast AST linting (`pnpm lint`). Prettier is the authoritative formatter (`pnpm format:check` / `pnpm format`). Do not run `biome format --write` as it produces style diffs that fail CI Prettier checks.
- **Typecheck scripts**: Always verify TypeScript across all packages with `pnpm typecheck` (`pnpm -r --if-present typecheck`), which checks `@rps/shared`, `apps/admin-web`, and `apps/mobile` in dependency order.
- `.env` for migrations is at the **repo root**, not `apps/backend`. `source: no such file` / `URL cannot be empty` = wrong cwd.
- golang-migrate leaves a **dirty** version after a half-failed migration: `force <prev>` then fix and `up`.
- pnpm blocks postinstall scripts: `[ERR_PNPM_IGNORED_BUILDS]` → `pnpm approve-builds` (select) → `pnpm install`. Hoisted layout ⇒ packages are in the **root** `node_modules`.

## Next.js / React
- **Radix Dialog click race**: Selecting an item from a shadcn `<Select>` inside a `<Dialog>` fires a pointer-down event on the select portal that Radix Dialog interprets as an outside click, causing the dialog to dismiss prematurely. Fixed in `components/ui/dialog.tsx` by setting a `menuOpenAtPointerDown` ref in `onPointerDownOutside` and calling `e.preventDefault()`.
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
