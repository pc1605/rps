# Admin Web Structure (Next.js 16, App Router)

`apps/admin-web/` · run `pnpm dev` → http://localhost:3000. Login `owner@ambika.local / admin123`.

```
app/(dashboard)/
  dashboard/page.tsx           stat cards (incl. "Ready for stitching" = stats.awaiting_assignment), recent activity
  batches/page.tsx             header + CreateBatchDialog + <Suspense><BatchList/></Suspense>
  batches/[id]/page.tsx        detail: header (phase/ready badge, Labels PDF), ShortCutPanel, AssignStitchersCard, BatchTimeline, units grid
  cars/page.tsx                flat items catalog list, ItemDialog, brand & product line filters
  stock/page.tsx               Raw (rolls) / Finished tabs
  workers/page.tsx             WorkerList (+ "Set up phone" per row), CreateWorkerDialog
  reports/page.tsx             RangePicker presets + WorkerReportTable + summary strip
components/layout/
  sidebar.tsx                  nav items; renders <BatchSubNav/> under Batches (inside <Suspense>)
  batch-subnav.tsx             phase sub-links /batches?phase=<key> with live counts from useBatchStats
components/ui/                 shadcn (button, card, badge, table, dialog, input, select, checkbox, tabs, …)
features/
  auth/                        login, store, refresh
  catalog/                     types, api, hooks, item-dialog (flat car items, brands, product lines)
  batches/
    types.ts                   Batch, BatchDetail, Unit, PhaseLogEntry, AssignmentEntry, AssignmentInput, BatchStats
    api.ts                     list/get/create/stats/setAssignments/markStickersPrinted/resolveShort
    hooks.ts                   useBatches, useBatch(id), useBatchStats, useCreateBatch, useSetAssignments(id), useMarkStickersPrinted, useResolveShort
    views.ts                   batchViews[]: key/label/dot/filter/count — shared by sub-nav and list
    label-pdf.ts               generateLabelPdf(batch, media)
    components/
      batch-list.tsx           config-driven table; filters by ?phase; Packing view adds Print/Reprint stickers column
      create-batch-dialog.tsx
      short-cut-panel.tsx      split / reduce / recut resolution actions for short cuts
      batch-timeline.tsx       vertical rail of phase_logs entries (multi-entry per phase supported)
      assign-stitchers-card.tsx  checkbox per active stitcher + quota inputs + Split evenly + Save / Assign & print
  workers/                     types, api, hooks, components (worker-list, create-worker-dialog, enrollment-qr-dialog, enrollment-code = the one-time code block)
  stock/, reports/             same pattern
lib/api-client.ts              axios; single-flight 401 → /auth/refresh; base URL from env
```

## Data flow
TanStack Query v5 everywhere. Mutations invalidate `["batches"]`, `["batch", id]`, `["workers"]`, `["car-models"]` as relevant.
**Live updates (RT1, D43)**: `lib/live.tsx`. `<LiveUpdates />` (mounted in `AppShell`) holds one open line to `GET /live`
while the tab is visible; on a "changed" note — and once after every (re)connect — it invalidates every query whose
options include `...live()` (`meta.live`). `live(pollMs)` also sets the fallback polling: `pollMs` while the line is
down (stats 5 s, batch lists / details / worker / unit / rework 10 s, materials 15 s, stuck 60 s — the pre-RT1 rates),
once a minute while it is up. `live()` without a number = pushed only, never polled (workers list, worker summary /
history, reports, finished stock, spares, movements, car overview). Not live on purpose: reference and form data
(car items, brands, lines, groups, recipes, overrides, settings, search). A hidden tab closes its line (browsers allow
~6 connections per server on HTTP/1.1) and reconnects + re-reads when it is shown again. An expired access token gets
a 401 on the line and a retry; the normal API calls refresh the token meanwhile.
Car models cache for 5 minutes (`staleTime: 5 * 60_000`).

## Lint rule that bites: `react-hooks/set-state-in-effect`
Never `useEffect(() => setState(props…))`. Reset draft state by remounting with a `key` derived from server state
(see `AssignStitchersCard` wrapper → `Inner key={batch.id + savedKey}`). Dialogs load data in `onOpenChange`, not effects.

## Dependencies added along the way
jspdf, qrcode (+ @types), qrcode.react, sonner (toasts), lucide-react, shadcn components (checkbox, tabs added Week 9).
