# Auth Model

## Two actor types, one Guard
- **Admin users** (`users` table, roles `owner`/`supervisor`): email + password → short-lived access token (in the
  response, kept in `localStorage`) + refresh token (**httpOnly cookie**, never in the response — see below).
  The web api-client does a **single-flight** `POST /auth/refresh` on 401.
- **Workers** (`workers` table): the admin sets the phone up once with a **one-time enrollment code** + the worker's
  4-digit `pin` → **30-day** token stored in `expo-secure-store`. They never log in again on that phone unless they
  sign out or sign in on another phone (one phone per worker, D44).

JWT claims carry `type: "user" | "worker"`; handlers check `auth.ActorType(c)`. Helpers: `auth.UserID(c)`,
`auth.WorkerID(c)`, `auth.StationFromCtx(c)`, `auth.RoleFromCtx(c)`, `authSvc.RequireRole("owner","supervisor")`.

## Default-deny Guard
The Guard middleware is mounted on the whole `/api/v1` group. Only `auth/login`, `worker/login`, `auth/refresh`,
`auth/logout` are public. **`/healthz` lives at the app root, outside the group** — it is public by design (uptime checks, Railway).
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

## Admin refresh cookie (E1, D45)
- `POST /auth/login` sets `rps_refresh`: **httpOnly** (page scripts can't read it, so an injected script can't steal a
  30-day session), `SameSite=Strict`, `Secure` when `ENV=production`, path `/api/v1/auth`, lifetime
  `JWT_REFRESH_TTL_DAYS`. The JSON carries only `access_token`.
- `POST /auth/refresh` reads **only the cookie** (a token in the body is ignored), re-checks the user is active, and
  answers with a new access token and a renewed cookie. A bad cookie is removed.
- `POST /auth/logout` removes the cookie (the page can't). Admin web: `tokenStore` keeps only `rps_access`;
  login / refresh / logout are sent `withCredentials`; a 401 from `/auth/*` itself is never answered with a refresh.
- CORS sends `Access-Control-Allow-Credentials: true`, so `CORS_ORIGINS` must name the admin origin (never `*`).
- **Deploy rule**: the admin web and the API must be on the **same site** — two names under one domain you own
  (`app.example.com` + `api.example.com`). On two unrelated host names (`x.vercel.app` + `y.up.railway.app`) the
  browser does not send the cookie and the admin is signed out every `JWT_ACCESS_TTL_MINUTES`.
- Workers are unchanged: the phone keeps its 30-day token in `expo-secure-store` (no cookie).

## Login limit (E1, D45)
- `httpx.LoginLimiter` on `POST /auth/login` and `httpx.WorkerLoginLimiter` on `POST /worker/login` (mounted in
  `cmd/server/main.go`): **10 failed tries per address per 15 minutes** for the admin (`LOGIN_MAX_FAILURES`), **50** for
  the worker login (× `WorkerLoginFactor` — every factory phone reaches the server from one address, and each code
  dies after 5 wrong PINs anyway), counted separately for the two routes. Successful logins
  don't count. Then **429 `too_many_attempts`** + `Retry-After`, also for a correct password, until the window ends.
- Counters are in the server's memory: a restart clears them, and they assume one backend instance (as D43 does).
- Behind a host's proxy every request seems to come from the proxy. Set `PROXY_HEADER` to the header the host fills
  with the real client address, or one wrong user locks everyone out. Use a header the host sets itself
  (a client can fake the first entry of `X-Forwarded-For` on many hosts).
- Phones in the factory share one address: 10 wrong codes / PINs in 15 minutes from the whole floor pause phone
  set-up for everyone. Signed-in phones are not affected (they never log in again).

## Secrets (E1)
- The repository never held a real `.env`, only `.env.example` — but the development `.env` uses those same
  placeholder values, so **every development secret is public**. Production generates its own
  (`openssl rand -hex 32` each): `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FILE_URL_SECRET`, a new database
  password, and `SEED_ADMIN_PASSWORD`.
- With `ENV=production` the backend refuses to start when a secret still begins with `change-me`, when
  `FILE_URL_SECRET` is missing, or when the two JWT secrets are equal; `cmd/seed` refuses to create the owner with the
  demo password (`admin123`) and needs `SEED_ADMIN_PASSWORD` (12+ characters; re-running the seed resets the owner's
  password to it).
- Nothing in the code holds a secret value; all are read from the environment in `internal/config`.
  `QR_HASH_SECRET` was read but never used and is gone.
- Changing the JWT secrets signs every admin and every phone out (phones need "Set up phone" again) — do it before
  the pilot, not during.

## Still open (pre-rollout)
- Refresh tokens can't be taken back one by one: deactivating an admin stops their refresh at once, but a stolen
  cookie of an active admin works until it expires. Changing `JWT_REFRESH_SECRET` ends all admin sessions.
