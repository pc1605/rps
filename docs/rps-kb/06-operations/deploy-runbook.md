# Running RPS on the server (AWS Lightsail, Mumbai) — D46

Everything runs on **one** small Lightsail server: the database, the backend, the admin web and Caddy (HTTPS).
One web address serves it all: the admin at `https://<site>/`, the API at `https://<site>/api/v1`.
Files: `deploy/` in the repo. On the server everything lives in `/srv/rps`.

| On the server | What it is |
|---|---|
| `/srv/rps/.env` | secrets, made on the server by `server-setup.sh` — never copy it off, never commit it |
| `/srv/rps/compose.yml`, `Caddyfile` | the four services, sent by `ship.sh` on every update |
| `/srv/rps/uploads/` | rework photos (owned by uid 10001, the backend's user) |
| `/srv/rps/backups/` | the last 14 database copies |
| `/var/log/rps-backup.log` | what the nightly backup did |

`/srv/rps/secrets/` holds the Firebase key (step 5), readable only by the backend.

Times: the server clock is UTC. Nightly copy 03:00 IST (21:30 UTC); security updates may reboot it at 03:30 IST.

## 1. Before you start (owner, one time)

1. **Domain**: buy one (e.g. `ambikaenterprise.in`). RPS will live on a sub-name such as `rps.ambikaenterprise.in`.
2. **AWS account**: sign up, then turn on two-step login (MFA) for the root user straight away.
3. **Lightsail → Create instance**
   - Region **Mumbai (ap-south-1)**, platform **Linux**, blueprint **OS only → Ubuntu 24.04 LTS**.
   - Plan: **2 GB memory** (dual-stack, $12).
   - Turn on **automatic snapshots** (a daily copy of the whole server, kept 7 days).
   - SSH key: create a new one and download it (`.pem`). Keep it safe — it is the only way into the server.
4. **Networking** (instance → Networking)
   - Create a **static IP** and attach it (free while attached).
   - IPv4 firewall: keep **SSH 22**, add **HTTPS 443** (TCP); keep **HTTP 80** (needed for the certificate).
     Restrict SSH to your own address if your internet has a fixed one.
5. **DNS** at the domain seller: add an **A record** `rps` → the static IP. Wait until it answers (minutes to an hour).

## 2. Set the server up (one time)

From the repo root on the laptop. Replace `<ip>` with the static IP and `<key>` with the downloaded key file.

```bash
chmod 600 ~/Downloads/<key>.pem
```

```bash
ssh-add ~/Downloads/<key>.pem
```

```bash
ssh ubuntu@<ip> mkdir -p rps-deploy && scp deploy/* ubuntu@<ip>:rps-deploy/
```

```bash
ssh ubuntu@<ip> sudo bash rps-deploy/server-setup.sh rps.<your-domain>
```

`server-setup.sh` installs updates, Docker, the firewall (SSH + web only), turns off password logins, adds swap,
makes `/srv/rps/.env` with **new random secrets**, and installs the nightly backup. Safe to run again.

## 3. First start

```bash
deploy/ship.sh ubuntu@<ip>
```

Then create the owner account — the password is typed, never shown or stored in a file (12+ characters):

```bash
ssh -t ubuntu@<ip> 'read -rsp "Owner password: " P && echo && cd /srv/rps && sudo SEED_ADMIN_PASSWORD="$P" docker compose run --rm -e SEED_ADMIN_PASSWORD backend rps-seed'
```

Sign in at `https://rps.<your-domain>` as `owner@ambika.local` with that password. In production the seed makes
**only** the owner — no demo cars or rolls. Enter the real catalogue in the admin web.

## 4. Copies off the server (strongly advised)

1. Lightsail → **Storage → Create bucket**, Mumbai, smallest plan, name e.g. `rps-backup-<something>`.
2. Bucket → **Permissions → Access keys → Create** — copy both values.
3. Put them in the server's `.env`:

```bash
ssh -t ubuntu@<ip> sudo nano /srv/rps/.env
```

   Fill `BACKUP_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (region stays `ap-south-1`). Save: Ctrl+O, Enter, Ctrl+X.
4. Test it:

```bash
ssh ubuntu@<ip> sudo /srv/rps/backup.sh
```

   Expect `sent off the server` and `backup ok`. The bucket keeps 30 days of database copies and every photo.

## 5. Phone notifications (N1)

The server sends notifications through Firebase with the **service-account key** (the one kept on the laptop at
`~/.rps/firebase-key.json`). It goes into `/srv/rps/secrets/`, readable only by the backend, and never into Git.

```bash
scp ~/.rps/firebase-key.json ubuntu@<ip>:firebase-key.json
```

```bash
ssh ubuntu@<ip> 'sudo install -o 10001 -g 10001 -m 400 firebase-key.json /srv/rps/secrets/firebase-key.json && rm firebase-key.json'
```

```bash
ssh ubuntu@<ip> 'sudo sed -i "s|^FCM_CREDENTIALS_FILE=.*|FCM_CREDENTIALS_FILE=/run/secrets/firebase-key.json|" /srv/rps/.env && cd /srv/rps && sudo docker compose up -d backend'
```

Check: `ssh ubuntu@<ip> 'cd /srv/rps && sudo docker compose logs backend | grep notifications'` shows
`phone notifications on`. The phones also need an APK built with `apps/mobile/google-services.json` (E3).
The key is not in the nightly copy: if the server is lost, make a new key in Firebase (Project settings → Service
accounts) and repeat these steps. Old keys can be deleted there too.

## 6. Alerts by email (optional, free)

At healthchecks.io make two checks: **"RPS backup"** (period 1 day, grace 2 hours) and **"RPS up"** (period
5 minutes, grace 15 minutes). Put their ping URLs in `.env` as `HC_BACKUP_URL` and `HC_UPTIME_URL`. You get an email
when the nightly copy fails or the site stops answering.

## 7. Updating RPS

Commit, then from the repo root:

```bash
deploy/ship.sh ubuntu@<ip>
```

It refuses uncommitted changes, builds both images on the laptop, sends them, **makes a database copy**, applies
new migrations, restarts, and checks `https://<site>/healthz`. A few seconds of downtime; phones reconnect by themselves.

## 8. Once a month (5 minutes)

```bash
ssh ubuntu@<ip> 'sudo tail -5 /var/log/rps-backup.log; df -h /; sudo docker compose -f /srv/rps/compose.yml ps'
```

Look for: `backup ok` on recent nights, disk under 80 %, all four services `Up`.

## 9. When something is wrong

- **Site down**: `ssh ubuntu@<ip> 'cd /srv/rps && sudo docker compose ps && sudo docker compose logs --tail 50'`.
  Restart everything: `ssh ubuntu@<ip> 'cd /srv/rps && sudo docker compose up -d'`.
- **Put a database copy back** (everything after that copy is lost; a copy of the current state is made first):

```bash
ssh -t ubuntu@<ip> sudo /srv/rps/restore.sh
```

  It lists the copies; then run it again with one of them, e.g. `sudo /srv/rps/restore.sh backups/rps-<time>.dump`,
  or `sudo /srv/rps/restore.sh s3:rps-<time>.dump` for a copy from the bucket (also brings back missing photos).
- **Whole server lost**: make a new instance from the latest Lightsail snapshot, attach the static IP to it. If there
  is no snapshot: new server → steps 2–3 → `restore.sh s3:<latest copy>`.
- **An update went wrong**: ship the previous commit (`git checkout <commit>` then `ship.sh`). Migrations only go
  forward — if the bad update changed the database, restore the copy `ship.sh` made just before it.

## Notes

- One backend only (D43 live updates, D45 login counters): never scale the backend to two copies.
- Phones (E3 build): `EXPO_PUBLIC_API_URL=https://rps.<your-domain>/api/v1`.
- Changing a JWT secret in `.env` signs out every admin and every phone (phones need "Set up phone" again).
- Tested on the dev machine (19 Nov 2026) under the project name `rps-deploytest`: the stack starts, HTTPS + headers,
  the login cookie (`secure`), the login limit sees each client's own address through Caddy, the live stream passes
  uncompressed, backup to an S3 stand-in, restore from a copy on the server and from the bucket (data and photos).
- First real server (27 Nov 2026): Lightsail **Sydney** trial (the account can only use Sydney until it moves to
  Mumbai), `rps.riddhicarmats.com`. `server-setup.sh` worked as written. `ship.sh` built, sent and migrated but never
  started the app, and still ended with exit 0: the remote steps reach bash on its input, and `docker compose run` /
  `exec` read that input too (even with `-T`) and swallowed the remaining steps. `-T` alone did not fix it; the remote
  steps now sit in a `{ … } </dev/null` block. If an update ever stops part way (`RPS_VERSION` in `/srv/rps/.env`
  differs from the running images), finish it on the server with
  `cd /srv/rps && sudo docker compose up -d --remove-orphans`.
