#!/usr/bin/env bash
# Put a database copy back. Everything written since that copy is lost — a fresh copy of the current state is made first.
#   sudo /srv/rps/restore.sh backups/rps-<time>.dump          a copy on the server
#   sudo /srv/rps/restore.sh s3:rps-<time>.dump                a copy from the bucket (also fetches the photos)
set -euo pipefail
if [ "$(id -u)" != 0 ] && [ -z "${RPS_APP:-}" ]; then echo "run with sudo" >&2; exit 1; fi
APP="${RPS_APP:-/srv/rps}"   # RPS_APP: only for testing elsewhere
cd "$APP"
set -a; source .env; set +a
AWS_CLI=amazon/aws-cli:2.31.0
src="${1:-}"
if [ -z "$src" ]; then
  echo "usage: restore.sh backups/rps-<time>.dump | s3:rps-<time>.dump" >&2
  echo "copies on this server:"; ls -1t backups/*.dump 2>/dev/null | head || true
  exit 1
fi

aws() {
  docker run --rm --network host -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION -e AWS_ENDPOINT_URL -e AWS_REQUEST_CHECKSUM_CALCULATION -e AWS_RESPONSE_CHECKSUM_VALIDATION \
    -v "$APP/backups:/backups" -v "$APP/uploads:/uploads" "$AWS_CLI" "$@"
}

if [[ "$src" == s3:* ]]; then
  name="${src#s3:}"
  aws s3 cp "s3://$BACKUP_BUCKET/db/$name" "/backups/$name" --only-show-errors
  src="backups/$name"
fi
[ -f "$src" ] || { echo "not found: $src" >&2; exit 1; }
docker compose exec -T postgres pg_restore -l < "$src" > /dev/null || { echo "$src is not a readable copy" >&2; exit 1; }

read -r -p "Replace ALL current data with $src? Type yes: " answer
[ "$answer" = "yes" ] || { echo "stopped, nothing changed"; exit 1; }

echo "==> Copy of the current state first"
"$APP/backup.sh"

echo "==> Restoring"
docker compose stop backend
# Whatever happens below, the backend starts again at the end.
trap 'docker compose up -d backend >/dev/null' EXIT
docker compose exec -T postgres psql -U rps -d postgres -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE rps WITH (FORCE)" -c "CREATE DATABASE rps OWNER rps"
docker compose exec -T postgres pg_restore -U rps -d rps --no-owner --exit-on-error < "$src"

if [ -n "${BACKUP_BUCKET:-}" ]; then
  echo "==> Photos from the bucket (adds missing ones, deletes nothing)"
  aws s3 sync "s3://$BACKUP_BUCKET/uploads/" /uploads --only-show-errors
  chown -R 10001:10001 uploads   # the backend runs as uid 10001
fi

echo "✓ restored $src"
