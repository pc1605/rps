# RPS Polish Backlog

This backlog records prioritized polish and enhancement opportunities observed across the codebase. Each item is classified by priority (P1 High / P2 Medium / P3 Low) with exact file references.

---

## P1 — High Priority (User Experience & Stability)

- [ ] **P1**: Add optimistic update rollback handling on batch assignment mutation to prevent stale stitcher state on network drop (`apps/admin-web/features/batches/components/assign-stitchers-card.tsx:112`).
- [ ] **P1**: Cache camera permission state in mobile store to prevent viewfinder flash during cold app resume (`apps/mobile/app/scan/[batchId].tsx:102`).
- [ ] **P1**: Display short-cut remainder batch linkage badge directly in the mobile batch detail screen when `parent_batch_id` is present (`apps/mobile/app/batch/[id].tsx:174`).
- [ ] **P1**: Add network reconnection auto-refetch for active pipeline queries in admin web (`apps/admin-web/features/batches/hooks.ts:28`).

---

## P2 — Medium Priority (Visual Polish & Ergonomics)

- [ ] **P2**: Implement swipe-to-refresh on mobile queue screen (`FlatList` `refreshControl`) for quick manual sync on the shop floor (`apps/mobile/app/home.tsx:175`).
- [ ] **P2**: Add subtle row highlight transition when a batch transitions phases via live polling (`apps/admin-web/features/batches/components/batch-list.tsx:82`).
- [ ] **P2**: Auto-focus barcode input field when opening ItemDialog on desktop keyboards (`apps/admin-web/features/catalog/components/item-dialog.tsx:168`).
- [ ] **P2**: Display human-readable relative time alongside exact `<time dateTime>` in batch timeline tooltip (`apps/admin-web/features/batches/components/batch-timeline.tsx:75`).
- [ ] **P2**: Support custom date range validation preventing `from > to` before server round-trip in productivity reports (`apps/admin-web/features/reports/components/range-picker.tsx:55`).

---

## P3 — Low Priority (Code Cleanliness & Enhancements)

- [ ] **P3**: Remove deprecated typography keys (`eyebrow`, `label`) from mobile theme once all legacy screens migrate (`apps/mobile/lib/theme.ts:32`).
- [ ] **P3**: Add keyboard shortcut (`Cmd/Ctrl + K`) to launch global batch search in web header (`apps/admin-web/components/layout/app-shell.tsx:48`).
- [ ] **P3**: Preload IBM Plex font weights during Expo splash screen rather than lazy font hook loading (`apps/mobile/app/_layout.tsx:28`).
- [ ] **P3**: Export reusable print stylesheet helper for batch label sheets to support thermal 4x6 label printers (`apps/admin-web/features/batches/label-pdf.ts:40`).
