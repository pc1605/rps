#!/usr/bin/env bash
# Put the current code on the server. Run from the repo root on your laptop:
#   deploy/ship.sh ubuntu@<server address>
# Builds both images here, sends them over SSH, saves a database copy, applies database changes, restarts.
set -euo pipefail

SERVER="${1:-}"
if [ -z "$SERVER" ]; then echo "usage: deploy/ship.sh <user@server>" >&2; exit 1; fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -n "$(git status --porcelain -- apps packages deploy)" ]; then
  echo "Uncommitted changes in apps/, packages/ or deploy/ — commit them first, so the server runs a known version." >&2
  exit 1
fi
VERSION=$(git rev-parse --short HEAD)

DOMAIN=$(ssh "$SERVER" "sudo grep '^SITE_DOMAIN=' /srv/rps/.env" | cut -d= -f2-)
if [ -z "$DOMAIN" ]; then echo "No SITE_DOMAIN on the server — run server-setup.sh first." >&2; exit 1; fi
echo "==> Shipping $VERSION to $SERVER (https://$DOMAIN)"

echo "==> Building images"
docker build --platform linux/amd64 -q -t "rps-backend:$VERSION" apps/backend >/dev/null
docker build --platform linux/amd64 -q -f apps/admin-web/Dockerfile \
  --build-arg "NEXT_PUBLIC_API_URL=https://$DOMAIN/api/v1" -t "rps-admin:$VERSION" . >/dev/null

echo "==> Sending images"
docker save "rps-backend:$VERSION" "rps-admin:$VERSION" | gzip | ssh "$SERVER" "gunzip | sudo docker load -q"

echo "==> Sending server files"
tar -C deploy -cz compose.yml Caddyfile backup.sh restore.sh uptime.sh |
  ssh "$SERVER" "sudo tar -xz -C /srv/rps && sudo chmod 0755 /srv/rps/*.sh"

ssh "$SERVER" "sudo bash -s" <<REMOTE
set -euo pipefail
cd /srv/rps
if [ -n "\$(docker compose ps -q postgres 2>/dev/null)" ]; then
  echo "==> Database copy before the update"
  ./backup.sh
fi
sed -i "s|^RPS_VERSION=.*|RPS_VERSION=$VERSION|" .env
echo "==> Database changes"
docker compose up -d --wait postgres
# -T: without it the command reads this script's remaining lines as its input, and nothing after it runs.
docker compose run --rm -T --no-deps backend sh -c 'migrate -path /app/migrations -database "\$DATABASE_URL" up'
echo "==> Starting $VERSION"
docker compose up -d --remove-orphans
docker image prune -af --filter "until=720h" >/dev/null
REMOTE

echo "==> Checking"
for _ in $(seq 30); do
  if curl -fsS -m 5 "https://$DOMAIN/healthz" >/dev/null 2>&1; then
    echo "✓ $VERSION is live at https://$DOMAIN"
    exit 0
  fi
  sleep 2
done
echo "✗ https://$DOMAIN/healthz does not answer — on the server: cd /srv/rps && sudo docker compose logs --tail 50" >&2
exit 1
