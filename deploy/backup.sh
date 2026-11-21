#!/usr/bin/env bash
# Copy of the database and the rework photos. Runs every night (cron) and before every update (ship.sh).
# Keeps 14 copies on the server; with BACKUP_BUCKET set, also sends them off the server (30 days kept there).
set -euo pipefail
APP="${RPS_APP:-/srv/rps}"   # RPS_APP: only for testing elsewhere
cd "$APP"
set -a; source .env; set +a
AWS_CLI=amazon/aws-cli:2.31.0

fail() {
  echo "$(date -u +%FT%TZ) backup FAILED: $*" >&2
  [ -n "${HC_BACKUP_URL:-}" ] && curl -fsS -m 10 --retry 3 "$HC_BACKUP_URL/fail" >/dev/null || true
  exit 1
}
trap 'fail "line $LINENO"' ERR

stamp=$(date -u +%Y-%m-%dT%H%M%SZ)
dump="backups/rps-$stamp.dump"

docker compose exec -T postgres pg_dump -U rps -d rps -Fc > "$dump"
# A copy that can't be read is no copy: list its contents to prove it opens.
docker compose exec -T postgres pg_restore -l < "$dump" > /dev/null
chmod 600 "$dump"
echo "$(date -u +%FT%TZ) database copy $dump ($(du -h "$dump" | cut -f1))"

ls -1t backups/rps-*.dump | tail -n +15 | xargs -r rm --

if [ -n "${BACKUP_BUCKET:-}" ]; then
  aws() {
    docker run --rm --network host -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION -e AWS_ENDPOINT_URL -e AWS_REQUEST_CHECKSUM_CALCULATION -e AWS_RESPONSE_CHECKSUM_VALIDATION \
      -v "$APP/backups:/backups:ro" -v "$APP/uploads:/uploads:ro" "$AWS_CLI" "$@"
  }
  aws s3 cp "/backups/$(basename "$dump")" "s3://$BACKUP_BUCKET/db/" --only-show-errors
  # Photos: only new files travel; a photo deleted here stays in the bucket.
  aws s3 sync /uploads "s3://$BACKUP_BUCKET/uploads/" --only-show-errors
  cutoff=$(date -u -d '30 days ago' +%Y-%m-%d)
  aws s3 ls "s3://$BACKUP_BUCKET/db/" | while read -r day _ _ name; do
    if [[ "$day" < "$cutoff" ]]; then aws s3 rm "s3://$BACKUP_BUCKET/db/$name" --only-show-errors; fi
  done
  echo "$(date -u +%FT%TZ) sent off the server to s3://$BACKUP_BUCKET"
fi

[ -n "${HC_BACKUP_URL:-}" ] && curl -fsS -m 10 --retry 3 "$HC_BACKUP_URL" >/dev/null || true
echo "$(date -u +%FT%TZ) backup ok"
