# H1 — Hindi on the worker phone app — hand-off prompt (Nov 2026)

Status: **planned, not started.** Paste the prompt below into a new agent session.
Owner direction (11 Nov 2026): the app is not in use on the floor yet; add Hindi before the pilot. Hindi only for now
(Gujarati not needed). R2 (material reports) is on hold. Work history and an "assigned to you" notification come after a pilot week
(NEXT-STEPS "Future plan"); the app never shows money (D40) — don't build any of it here.

```text
Do slice H1 — Hindi on the worker phone app (apps/mobile). Read AGENTS.md first, then docs/rps-kb/README.md,
docs/rps-kb/08-roadmap/NEXT-STEPS.md and docs/rps-kb/05-mobile/structure.md.

GOAL
A worker can use the whole phone app in Hindi. English stays available. Nothing else changes: no new screens beyond
what language choice needs, no backend changes, no new features. If something starts to look like a feature, stop and
ask me.

STATE
- master = 745a6db (P1 merged): every user-facing phone text is in apps/mobile/lib/strings.ts (one `strings` object,
  ~190 entries, some are functions for counts/names). 12 files import it directly as a module constant.
- Work on branch agent/h1-hindi (created from master; only adds this hand-off). Never commit on master.
- No Claude co-author / attribution lines in commits or PRs. Commit style "[H1] ...", one commit per step.

DECISIONS (owner, Nov 2026)
- Languages: English and Hindi (हिन्दी). Gujarati: not now.
- Default language on a fresh install: Hindi (workers are Hindi readers). The owner can still change this — ask me
  before building if you think English should be the default.
- The choice is per phone, remembered across sign-out and app restarts.
- Unchanged in every language: batch codes, unit codes, car brand/model names, product line names, worker names,
  digits (0–9, not Devanagari numerals), the RPS name.

THE LIST
1. Language switching. A small store for the current language, persisted with expo-secure-store (already installed —
   don't add AsyncStorage or expo-localization just for this; expo-localization would need a native rebuild).
   Components read texts through a hook (e.g. useStrings()) so switching re-renders at once; code outside React
   (lib/api-client.ts, features/auth/store.ts) reads the current language through a plain getter. Keep the existing
   key structure of strings.ts so the call sites change as little as possible.
2. The Hindi texts. A Hindi object with exactly the English keys; TypeScript must fail the build if a key is missing or
   a function has the wrong arguments (type the Hindi object from the English one). Plural/number helpers stay
   functions. Rework reason labels (strings.rework.reasons) included.
3. Labels that come from @rps/shared and reach the phone: PHASE_LABEL, STATION_LABEL, SIZE_LABEL (app/home.tsx,
   app/batch/[id].tsx). Translate them on the phone side (strings.ts), keyed by the shared enum values — don't change
   @rps/shared (the admin web uses it, English only).
4. Server error messages. Places that show ApiError.message (app/batch/[id].tsx, app/scan/[batchId].tsx,
   app/rework/new.tsx, app/rework/fix/[id].tsx, features/auth/store.ts) show English from the server. Map the error
   codes the phone can actually receive (ApiErrorCode in packages/shared/src/constants.ts; check which handlers each
   phone call can hit) to phone strings, and fall back to the server message only for a code you don't know. Don't
   change server messages.
5. Language picker. On the login screen (top, small, always visible: "English | हिन्दी") and once on home (next to
   Sign out or in the header). No settings screen.
6. Font. The app font (IBM Plex Sans, lib/theme.ts) has no Devanagari letters. Add Noto Sans Devanagari
   (@expo-google-fonts/noto-sans-devanagari — font files, loads through expo-font, no native rebuild) in the same
   weights the theme uses, and use it while Hindi is on. Check on Android that mixed text (Hindi + batch codes/digits)
   renders in one consistent font and that nothing is clipped (Devanagari needs more line height for matras).
7. Layout pass. Hindi lines are longer: check every screen (login, enroll scan, home + My work card, batch screen
   incl. the cutter stepper, scanner overlays and flashes, packer inspect sheet, rework send 1/2 + 2/2, rework detail,
   rework fix) at normal and largest Android font size. Buttons keep ≥ 48 px touch targets; nothing truncates a
   number or a code.
8. Accessibility texts (accessibilityLabel / announceForAccessibility) in Hindi too — they're already in strings.ts.

HINDI WORDING (most important part — the owner will review every screen)
- Plain spoken factory Hindi, short. Not formal/Sanskritised Hindi (no "कृपया प्रतीक्षा करें"-style phrases when
  "रुकिए…" does).
- Keep the English words the floor already uses, written in Devanagari or left in English where that reads better:
  batch (बैच), scan (स्कैन), QR, rework (रीवर्क), PIN, OK. Ask me if unsure — the owner decides floor words.
- Station names: cutter = कटर, stitcher = सिलाई (or स्टिचर — ask), packer = पैकर.
- Keep the emoji/icons that are already in the texts (✓ ✗ ⏳ 📌 👤 🔦 📷 🔧); they carry meaning for workers who read
  slowly.
- Write the full Hindi list into docs/rps-kb/05-mobile/hindi-texts.md as a two-column table (English | हिन्दी),
  grouped by screen, so the owner can review it without opening code. Mark any line you're unsure of with "?".

TESTS / VERIFY
- No mobile test runner exists; the type check is the safety net: pnpm typecheck must fail if a Hindi key is removed
  (try it once, then put it back).
- Run the full AGENTS.md verify list + scripts/review.sh master before saying done. Show commands in one fenced block
  and the results OUTSIDE it — the owner pastes fenced blocks into the shell.
- The agent can't run the phone app. At the end, add a short "Hindi on a real phone" checklist to
  docs/rps-kb/06-operations/testing.md (switch language on login and home, restart keeps it, every screen in Hindi,
  largest font size, a wrong-batch / spare / quota flash, an error while offline, sign out → language kept) and give
  it to me.

DOCS
- docs/rps-kb/05-mobile/structure.md: how language works (store, hook, getter, font switch, where to add a text).
- AGENTS.md "Mobile rules": new user-facing text goes in strings.ts in BOTH English and Hindi.
- docs/rps-kb/07-decisions/decision-log.md: D41 — Hindi on the phone (choices above).
- NEXT-STEPS: tick H1 when merged.

Start by confirming you've read this and the mobile code, say anything in this list that turned out to be wrong,
then work through the list in order. Ask me only about Hindi wording or anything a worker would notice beyond Hindi.
```
