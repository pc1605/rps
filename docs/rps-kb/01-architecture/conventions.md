# Coding Conventions

## Backend (Go)
- Raw SQL via pgx; every multi-row read is `Query → for rows.Next() → Scan`. **Column count must equal scan target
  count** — a mismatch compiles fine and fails at runtime (or silently swaps values if types match). Lay Scan args out
  vertically and grouped like the SELECT.
- Every mutation runs in a transaction; `defer tx.Rollback(ctx)`; audit written in the **same** tx (`audit.Write`) — Hard Rule 16.
- Sentinel errors (`ErrWrongPhase`, `ErrNotAssigned`, …) are matched with `errors.Is`; messages are user-facing and
  flow to the phone. Handlers may override with context-specific text (see scan handler).
- Handler `Internal` paths log the real error: `log.Error().Err(err).Msg("list batches")` (zerolog) before returning
  the generic 500. Keep doing this for every new handler.
- Response envelope: `{"data": …}` via `httpx.OK`; errors `{"code": "...", "error": "..."}` via `httpx.Error`.
- Go initialisms: `ID` not `Id`.
- Run `gofmt -w internal/<pkg>/*.go` before building.

## Admin web (Next.js)
- `"use client"` components; TanStack Query v5 (`isPending` for "no data yet", not `isLoading`).
- **No prop→state `useEffect`** (lint `react-hooks/set-state-in-effect`). To reset local draft state when server
  state changes, **remount via `key`** (see `assign-stitchers-card.tsx`).
- Amber is the accent (`text-amber-600 dark:text-amber-400`); phase colors: cutting cyan, stitching pink, packing amber, completed lime.
- Mono uppercase tracking-wider for eyebrows/section labels.

## Mobile (Expo)
- Unistyles v3: `StyleSheet.create((theme) => ({...}))`; theme tokens in `lib/theme.ts` (`text.eyebrow|title|label|body|button`,
  `colors.*`, `spacing.*`, `radius.*`). There is **no** `text.caption` token — use `label`.
- Import `../lib/unistyles` FIRST in `app/_layout.tsx`.
- Own primitives: `Screen`, `Card`, `AppButton`.
- Never toggle `onBarcodeScanned` between a function and `undefined` — it restarts the camera (black preview). Gate
  with a `lock` ref inside the handler instead.
- Cross-screen transient state (e.g. scanned enrollment code) goes in a small zustand store, not route params.

## Types are duplicated 3× (Go / web TS / mobile TS)
Any JSON field change must be applied in all three. A `packages/shared` types package is overdue.
