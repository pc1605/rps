# Auth Model

## Two actor types, one Guard
- **Admin users** (`users` table, roles `owner`/`supervisor`): email + password → short-lived access token + refresh token.
  `POST /auth/refresh` exists; the web api-client does a **single-flight** refresh on 401.
- **Workers** (`workers` table): enroll once with `badge_token` + 4-digit `pin` → **30-day** token stored in
  `expo-secure-store`. They never log in again on that phone unless they sign out.

JWT claims carry `type: "user" | "worker"`; handlers check `auth.ActorType(c)`. Helpers: `auth.UserID(c)`,
`auth.WorkerID(c)`, `auth.StationFromCtx(c)`, `auth.RoleFromCtx(c)`, `authSvc.RequireRole("owner","supervisor")`.

## Default-deny Guard
The Guard middleware is mounted on the whole `/api/v1` group. Only `auth/login`, `worker/login`, `auth/refresh` are
public. **`/healthz` lives at the app root, outside the group** — it is public by design (uptime checks, Railway).
Consequence: an unknown path under `/api/v1` returns **401 before 404** — unauthenticated callers can't probe routes.
Don't "fix" this.

## Worker enrollment
- Admin creates worker → response includes `badge_token` once. Admin UI shows QR `RPS-ENROLL:<badge_token>` + text.
- Any time later: Workers list → QR icon → `GET /workers/:id/enrollment` re-shows the QR (admin-only).
- Phone: Login → "Scan enrollment code" (`app/enroll-scan.tsx`, validates `RPS-ENROLL:` prefix) → fills the code via
  the `useEnrollDraft` zustand store → PIN → `POST /worker/login` → token saved → `/home`. Typing the code is the fallback.
- Cold start: `app/index.tsx` checks SecureStore → `/home` (then `restore()` loads `/worker/me`) or `/login`.

## Known hardening gaps (pre-rollout, §3/§4 — NOT built)
- 30-day worker tokens are not re-checked against `workers.is_active` per request → deactivation takes effect at expiry.
- Badge tokens are permanent; the plan is one-time, expiring enrollment codes (endpoint URL kept, semantics swapped).
- No login rate-limiting (4-digit PINs).
- Admin refresh token should move to an httpOnly cookie; rotate all secrets at deploy.
