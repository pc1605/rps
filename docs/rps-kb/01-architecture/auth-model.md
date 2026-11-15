# Auth Model

## Two actor types, one Guard
- **Admin users** (`users` table, roles `owner`/`supervisor`): email + password → short-lived access token + refresh token.
  `POST /auth/refresh` exists; the web api-client does a **single-flight** refresh on 401.
- **Workers** (`workers` table): the admin sets the phone up once with a **one-time enrollment code** + the worker's
  4-digit `pin` → **30-day** token stored in `expo-secure-store`. They never log in again on that phone unless they
  sign out or sign in on another phone (one phone per worker, D44).

JWT claims carry `type: "user" | "worker"`; handlers check `auth.ActorType(c)`. Helpers: `auth.UserID(c)`,
`auth.WorkerID(c)`, `auth.StationFromCtx(c)`, `auth.RoleFromCtx(c)`, `authSvc.RequireRole("owner","supervisor")`.

## Default-deny Guard
The Guard middleware is mounted on the whole `/api/v1` group. Only `auth/login`, `worker/login`, `auth/refresh` are
public. **`/healthz` lives at the app root, outside the group** — it is public by design (uptime checks, Railway).
Consequence: an unknown path under `/api/v1` returns **401 before 404** — unauthenticated callers can't probe routes.
Don't "fix" this.

## Route gating (U0 / audit G4)
Guard only proves *some* valid token. Every admin route also carries `RequireRole("owner","supervisor")`, so a worker
token (role = station) gets **403**: all of `/batches*`, `/rework` + `/rework/:id/decide`, catalog (`/car-models`,
`/car-brands`, `/product-lines`, `/rolls`), `/stock/*`, `/reports/*`, `/workers*` incl. `POST /workers/:id/enrollment`.
Worker routes are `/worker/*` only; their handlers check the worker token/station. `/files/rework/:name` stays public
(HMAC-signed URL). **New admin route ⇒ add the role middleware**; the phone app must only call `/worker/*`.
Before U0, worker tokens could read every batch, fetch any worker's enrollment secret, and create/edit car models.

**Deactivation is immediate (U1):** for worker tokens the Guard also checks `workers.is_active` (PK lookup) on every
request → a deactivated worker's existing 30-day token gets 401 "worker deactivated — ask your admin".

## Worker enrollment (D44) — one-time code, in front of the admin
- Admin: Workers → **Set up phone** (also the second step of Add worker) → `POST /workers/:id/enrollment` makes a
  fresh **6-digit code**: works **once**, for **10 minutes**, and replaces any earlier code for that worker. Shown as QR
  `RPS-ENROLL:<code>` plus the digits, with the time left and a "New code" button. Only the SHA-256 of the code is
  stored (`workers.enroll_code_hash`, `enroll_expires_at`); nothing permanent exists to copy.
- Phone: Login → "Scan enrollment code" (`app/enroll-scan.tsx`, accepts `RPS-ENROLL:` + 6 digits) → the login screen
  only says "Code scanned ✓" — the code is never shown → PIN → `POST /worker/login {code, pin}` → token saved → `/home`.
  Camera broken: "Enter code by hand" opens a field that shows dots; the **admin** types the digits from their screen.
- Wrong PIN: the code survives 4 wrong tries and dies on the 5th (`enroll_tries`); the admin makes a new one.
- **One phone per worker**: every sign-in raises `workers.session_no`, the token carries it (`sn` claim), and the
  Guard refuses a token whose number differs → 401 `signed_in_elsewhere`. The phone then signs itself out and the login
  screen says why. Tokens issued before D44 carry no number (= 0) and keep working until the worker's next sign-in.
- Cold start: `app/index.tsx` checks SecureStore → `/home` (then `restore()` loads `/worker/me`) or `/login`.

## Known hardening gaps (pre-rollout, §3/§4 — NOT built)
- No login rate-limiting (4-digit PINs).
- Admin refresh token should move to an httpOnly cookie; rotate all secrets at deploy.
