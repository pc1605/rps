# Admin Web Structure (Next.js 16, App Router)

`apps/admin-web/` · run `pnpm dev` → http://localhost:3000. Login `owner@ambika.local / admin123`.

```
app/(dashboard)/
  dashboard/page.tsx           stat cards (incl. "Ready for stitching" = stats.awaiting_assignment), recent activity
  batches/page.tsx             header + CreateBatchDialog + <Suspense><BatchList/></Suspense>
  batches/[id]/page.tsx        detail: header (phase/ready badge, Labels PDF), AssignStitchersCard, BatchTimeline, units grid
  stock/page.tsx               Raw (rolls) / Finished tabs
  workers/page.tsx             WorkerList (+ enrollment QR per row), CreateWorkerDialog
  reports/page.tsx             RangePicker presets + WorkerReportTable + summary strip
components/layout/
  sidebar.tsx                  nav items; renders <BatchSubNav/> under Batches (inside <Suspense>)
  batch-subnav.tsx             phase sub-links /batches?phase=<key> with live counts from useBatchStats
components/ui/                 shadcn (button, card, badge, table, dialog, input, select, checkbox, tabs, …)
features/
  auth/                        login, store, refresh
  batches/
    types.ts                   Batch, BatchDetail, Unit, PhaseLogEntry, AssignmentEntry, AssignmentInput, BatchStats
    api.ts                     list/get/create/stats/setAssignments/markStickersPrinted
    hooks.ts                   useBatches, useBatch(id), useBatchStats, useCreateBatch, useSetAssignments(id), useMarkStickersPrinted
    views.ts                   batchViews[]: key/label/dot/filter/count — shared by sub-nav and list
    label-pdf.ts               generateLabelPdf(batch, media)
    components/
      batch-list.tsx           config-driven table; filters by ?phase; Packing view adds Print/Reprint stickers column
      create-batch-dialog.tsx
      batch-timeline.tsx       vertical rail of phase_logs entries (multi-entry per phase supported)
      assign-stitchers-card.tsx  checkbox per active stitcher + quota inputs + Split evenly + Save / Assign & print
  workers/                     types, api, hooks, components (worker-list, create-worker-dialog w/ QR, enrollment-qr-dialog)
  stock/, reports/             same pattern
lib/api-client.ts              axios; single-flight 401 → /auth/refresh; base URL from env
```

## Data flow
TanStack Query v5 everywhere. Mutations invalidate `["batches"]`, `["batch", id]`, `["workers"]` as relevant.
Stats poll every 5s (drives sidebar counts). Lists poll periodically (**VERIFY** interval).

## Lint rule that bites: `react-hooks/set-state-in-effect`
Never `useEffect(() => setState(props…))`. Reset draft state by remounting with a `key` derived from server state
(see `AssignStitchersCard` wrapper → `Inner key={batch.id + savedKey}`). Dialogs load data in `onOpenChange`, not effects.

## Dependencies added along the way
jspdf, qrcode (+ @types), qrcode.react, sonner (toasts), lucide-react, shadcn components (checkbox, tabs added Week 9).
