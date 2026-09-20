# Mobile App Structure (Expo SDK 57, dev build)

`apps/mobile/` · package name in package.json must be lowercase `mobile`; Expo config (name "RPS Worker", slug/scheme
`rps-worker`, plugins incl. `expo-camera` with permission text) lives in `app.json` only.

```
app/
  _layout.tsx            imports ../lib/unistyles FIRST; QueryProvider; <Stack headerShown=false>
  index.tsx              cold start: SecureStore token? → /home : /login
  login.tsx              scan button → code field (store-backed) → PIN → "Set up this phone"
  enroll-scan.tsx        camera; accepts RPS-ENROLL:<badge>; writes useEnrollDraft.badge; router.back()
  home.tsx               header (station queue label, name, sign out); queue FlatList of BatchCard; pull-to-refresh; error state
  batch/[id].tsx         station-specific action card (cutter: Start / blocked / qty+Complete; stitcher/packer: Join / progress+Open scanner)
  scan/[batchId].tsx     CameraView scanner: local validation, scan lock, feedback flashes, progress pill, done screen
components/ui/           Screen, Card, AppButton
features/auth/
  store.ts               zustand: worker, login(code,pin), restore() (/worker/me), logout(); token in SecureStore
  enroll-draft.ts        zustand: badge scanned on enroll-scan, consumed by login (cleared after login)
features/batches/
  types.ts               Batch (queue payload), ScanResult
  api.ts                 myBatches, start, complete, scanUnit
  hooks.ts               useMyBatches (poll ~15s), useStartBatch, useCompleteBatch, useScanUnit (invalidates on phase/batch completion)
lib/
  api-client.ts          axios; token interceptor from SecureStore; ApiError{status, code, message}; ngrok-skip-browser-warning header
  theme.ts               dark + light AppTheme (string colors, text.eyebrow|title|label|body|button, spacing, radius)
  unistyles.ts           StyleSheet.configure(themes, adaptiveThemes: true)
  query-provider.tsx
```

## State rules
- Server is the source of truth; the app holds almost nothing (token, worker profile, transient enroll draft).
- Progress on the scanner is seeded from the queue payload (`units_stitched/packed`, `my_done_qty/target`) and then
  updated from each `ScanResult`. Other workers' scans on the same batch show up on the next poll, not live.
- Use `isPending` (not `isLoading`) for "no data yet" — see gotchas.
