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
components/ui/           AppButton, Banner, Card, Chip, Screen, Skeleton, Stat
components/LanguagePicker.tsx   "English | हिन्दी" — on login (top) and in the home header
features/auth/
  store.ts               zustand: worker, login(code,pin), restore() (/worker/me), logout(); token in SecureStore
  enroll-draft.ts        zustand: badge scanned on enroll-scan, consumed by login (cleared after login)
features/batches/
  types.ts               Batch (queue payload), ScanResult
  api.ts                 myBatches, start, complete, scanUnit
  hooks.ts               useMyBatches (poll ~10-15s), useStartBatch, useCompleteBatch, useScanUnit (invalidates on phase/batch completion)
lib/
  api-client.ts          axios; token interceptor from SecureStore; ApiError{status, code, message}; ngrok-skip-browser-warning header
  theme.ts               themesFor(language) → dark + light AppTheme (Plex Sans & Mono; Noto Sans Devanagari for Hindi; 4-pt grid, touch targets 48/56, contrast-verified tokens)
  unistyles.ts           StyleSheet.configure(themesFor(saved language), adaptiveThemes: true)
  strings.ts             English texts (`en`), the `Strings` type every language must match, PhoneErrorCode
  strings.hi.ts          Hindi texts (`hi: Strings`)
  language.ts            language store (SecureStore `rps_language`), useStrings(), getStrings(), LANGUAGES
  errors.ts              errorText(strings, error, fallback): server error code → text in the current language
  use-online.ts          NetInfo hook driving offline notice banners across screens
  query-provider.tsx
```

## Language (H1, D41) — English and Hindi
- **Texts**: `lib/strings.ts` holds English (`en`); `lib/strings.hi.ts` holds Hindi, typed `Strings` (= the English
  shape), so `pnpm typecheck` fails when a Hindi key is missing, extra, or a function takes other arguments.
  Full list for wording review: `hindi-texts.md`.
- **Store**: `lib/language.ts` — zustand `useLanguage` (`language`, `setLanguage`). Saved per phone in SecureStore
  under `rps_language`, read synchronously at start (first screen is already in the saved language). Fresh install =
  Hindi. Sign-out only clears the token, so the language stays.
- **Reading texts**: components call `const strings = useStrings()` (re-renders on switch). Code outside React calls
  `getStrings()` at the moment of use (only `lib/api-client.ts` today). Never import `en` / `hi` in a screen.
- **Shared labels**: station, phase and size labels come from `strings.station / .phase / .size` (keyed by the
  `@rps/shared` enum values). English reuses the `@rps/shared` constants; `@rps/shared` itself stays English.
- **Server errors**: screens never show `ApiError.message` directly. `errorText(strings, e, fallback)` looks the code
  up in `strings.errors` (`PhoneErrorCode` = every code a `/worker/*` call can return + `bad_request`, `forbidden`,
  `network_error`); only an unknown code falls back to the server's English message. The auth store keeps the thrown
  error, and the login screen words it (there `unauthorized` = "Wrong code or PIN"), so it follows a language switch.
- **Font**: IBM Plex Sans has no Devanagari. In Hindi `themesFor("hi")` swaps the four Plex Sans weights for Noto Sans
  Devanagari (it also has Latin letters and digits, so mixed lines are one font), raises line heights to ≥ 1.4 × size
  (matras get clipped on Android otherwise) and sets letter spacing to 0. Codes stay IBM Plex Mono. `setLanguage`
  applies it with `UnistylesRuntime.updateTheme` on both themes. All fonts load in `app/_layout.tsx` (expo-font — no
  native rebuild; a release APK still needs a new build to carry the new bundle).
- **Adding a text**: add the key to `en`, add the Hindi to `hi` (type check tells you where), add the row to
  `hindi-texts.md`. Keep digits 0–9 and never translate codes or names.
- **Not covered**: the time on the rework detail ("Sent back by … · 10:42 am") uses the phone's own locale; the
  Android camera-permission pop-up is system text.

## State rules
- Server is the source of truth; the app holds almost nothing (token, worker profile, transient enroll draft).
- Progress on the scanner is seeded from the queue payload (`units_stitched/packed`, `my_done_qty/target`) and then
  updated from each `ScanResult`. Other workers' scans on the same batch show up on the next poll, not live.
- Use `isPending` (not `isLoading`) for "no data yet" — see gotchas.
