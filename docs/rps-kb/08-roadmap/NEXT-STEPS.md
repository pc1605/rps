# RPS — status & next steps (handoff)

## Done (on master)
- Core flow: batches → cutting → admin assignment gate (per-head quotas) → multi-stitcher scan-per-mat → packing → completed.
- Short-cut policy (admin resolves: split / reduce / recut). Cars catalogue (flat items = car × size × product line, barcodes).
- Slice B rework: packer inspect sheet (peek first) + photo capture (2-step) → routing by reason (stitcher / admin), rounds,
  escalation on round 2, admin decisions (to stitcher / re-cut / write off), history on every mat, signed photo URLs.
- Design system (tokens, primitives, responsive shell), a11y pass, KB (`docs/rps-kb/`).
- Tooling: golangci-lint, Go smoke + rework tests, Biome lint, Prettier, lefthook (pre-commit format+lint, pre-push typecheck+go test), `@rps/shared`.

## Next, in order
1. **Add `AGENTS.md`** (this folder) to the repo root; make `CLAUDE.md` contain just: `See AGENTS.md.`
2. **Slice C — materials & consumption (fully admin-editable)**
   - C1 backend (precision work): material types (unit, min level, has_variants) · variants by spec (e.g. width 54″/60″) ·
     lots = existing `raw_materials` (+ type, variant) · consumption groups (seeded Small/Medium/Large, editable, cars assigned)
     · recipes = product line × group, lines per material (default + per-variant qty) · per-car overrides ·
     resolution: car+variant > car > recipe+variant > recipe > none · consumption at cutting-complete (roll lot first, rest FIFO,
     never below 0, shortfall logged, missing recipe = note, no block) · movements ledger (receive/consume/adjust/shortfall) ·
     endpoints for all of it + resolve preview + batch materials + cutter "materials needed" + low_stock_types stat.
     Full prompt was written in chat; key decisions are above. Split into 3 runs: schema+shared types → engine+tests → endpoints.
   - C2 admin: Materials page (types, variants, lots, receive/adjust, movements), Recipes grid (groups × materials, per-variant columns),
     group + overrides in car dialog, "Materials used" on batch detail, dashboard low stock.
   - C3 mobile: cutter "You'll need …" panel; scan roll QR at cutting start (needs lot QR labels printed from Materials page).
3. **Slice E — hardening & deploy**
   - E1 (precision, review auth diff carefully): per-request is_active + token_version check (cached 60 s), one-time enrollment codes
     (15 min, single use, QR `RPS-ENROLL:<code>`), login rate limits (5 PINs/worker, 20/IP per 15 min), admin PIN reset (bumps
     token_version), admin refresh token → httpOnly cookie, production secret checks.
   - E2 deploy: Railway (API + Postgres + volume for uploads) or VPS; Vercel (admin); domain + HTTPS; migrations on deploy; daily backups.
   - E3 mobile: EAS Build (signing key) + EAS Update (OTA); API URL → real domain; consider portrait lock.
   - E4 pilot: 1 week, 3–5 workers.
4. Later: multi-language (Hindi default/fallback, phone-language detection + first-launch picker, Devanagari font, error-code messages);
   earnings (piece rates × scans).

## Open questions for the owner
- Roll widths bought; metres per set on each width for one common car; do cutters know which roll they cut from?
- Workers' languages / where they come from; who can review translations.
- Re-cut process; is the rework photo mandatory; "quick pack" toggle wanted?; lock worker app to portrait?
- Hosting choice + domain name.

## Review routine (for every agent task)
branch → agent works → run gates yourself → `scripts/review.sh master` → read the risky diff (or have the other agent review it,
read-only) → merge `--no-ff` → push (hooks run).
