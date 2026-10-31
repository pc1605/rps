# AGENTS.md — rules for any coding agent working on RPS

Read this first, then `docs/rps-kb/README.md`. Applies to Claude Code, Gemini/Antigravity, or any other agent.

## Project
RPS (Riddhi Production System) — production tracking for a car floor-mat factory (Ambika Enterprise · Riddhi Car Floor Laminates).
Monorepo (pnpm workspace, hoisted node_modules):
- `apps/backend` — Go, Fiber v2, pgx raw SQL, golang-migrate, zerolog. Domain logic in `internal/batch` (service.go, rework.go, handler.go, routes.go, types.go).
- `apps/admin-web` — Next.js 16 App Router, Tailwind v4 tokens, shadcn in `components/ui`, RPS primitives in `components/rps`.
- `apps/mobile` — Expo SDK 57 **dev build**, expo-router, Unistyles v3, TanStack Query v5. Worker app (cutter/stitcher/packer).
- `packages/shared` — `@rps/shared`: ALL API types + constants (UNIT_CODE_RE, ENROLL_PREFIX, labels, ApiErrorCode). Never redeclare these in apps.
- `docs/rps-kb/` — knowledge base (domain, API, decisions, gotchas). Keep it updated with every slice.

## Working rules
1. Work on the CURRENT branch. Never switch to or commit on `master`. One agent per branch.
2. Read the code before changing it. Don't guess endpoints, columns or enum names — check migrations / `\d table`.
3. No behaviour changes outside the task. List anything you change outside scope and why.
4. Small, separate commits per logical step.
5. Never log credentials (PINs, codes, tokens). Never commit `.env`.

## Backend rules
- Every mutation in a tx with `defer tx.Rollback(ctx)`; audit row in the same tx (`audit.Write`).
- Errors are sentinels matched with `errors.Is`; handlers map them to `httpx.Error(c, status, code, msg)`; log real errors with zerolog before `httpx.Internal`.
- SELECT columns and Scan targets must match 1:1 (most common bug here). Nullable columns → pointer fields.
- Migrations: run from repo root: `set -a; source .env; set +a; migrate -path apps/backend/migrations -database "$DATABASE_URL" up`. Use the next free number. Enum names: `batch_phase`, `batch_status`, `unit_status`, `worker_station`, `car_size`.
- Seeds: run from repo root: `scripts/seed-dev.sh <db_name> [--force]` (database name required; `rps` requires `--force`). Chains `go run ./cmd/seed` → `seeds/01-catalog.sql` → `seeds/02-demo.sql` → `scripts/seed-uploads.sh`.
- Photos: signed URLs (`?exp=&sig=`), public file route verifies the signature. Never require auth headers on image URLs.

## Admin web rules
- Tokens only: `text-brand` (amber = "act here" ONLY), `text-danger`, `bg-phase-{cutting,stitching,packing,completed}`, `text-h1/h2/body/small/caption`, `tabular`. No raw palette classes (`text-red-500` etc.), no `text-[11px]`.
- Sentence case; `font-mono` only for codes/barcodes.
- Lists use `DataTable` (cards < md); pages use `PageHeader`; empty/error via `EmptyState`; loading via skeletons; TanStack v5 `isPending`.
- Forms: `<form onSubmit>`, `Label htmlFor` + `id`, explicit button `type`. Mutations: success + error toast. Destructive actions: `AlertDialog`.
- Don't edit `components/ui/dialog.tsx` (contains the Radix nested-menu race fix). Combobox in dialog: `<Popover modal>`.
- Images: `RemoteImage` (opacity fade, never `hidden` + `loading="lazy"`).

## Mobile rules
- Tokens from `lib/theme.ts` only (no hex/rgba, no `fontWeight`, no raw font sizes); add tokens to BOTH themes.
- Screens use `Screen` / `ScreenHeader` (safe areas); primary action in the bottom `footer`; touch targets ≥ 48 px.
- Scanner rules: `lock` ref check is the FIRST line of the handler; `onBarcodeScanned` stays a stable function (never conditional); mount `CameraView` only when the screen is focused and the transition has ended; unmount before navigating away; `onMountError` → retry banner.
- New user-facing text goes in `lib/strings.ts` (future translation source; Hindi planned).
- Feedback (haptic + sound) via `lib/feedback.ts`.

## Verify before saying "done" (paste the output)
```
pnpm typecheck && pnpm lint && pnpm format:check
cd apps/backend && go build ./... && golangci-lint run ./... && go test ./...
cd apps/admin-web && pnpm build          # when admin changed
```
Then `scripts/review.sh master` and list: files changed, anything out of scope, red flags.

## Commit style
`[<slice>] short description` e.g. `[C1] consumption engine + FIFO draw`.
