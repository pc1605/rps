#!/usr/bin/env bash
set -euo pipefail

# scripts/test-db.sh — (re)create the ISOLATED test database `rps_test`:
#   drop (force) → create → all migrations → scripts/seed-dev.sh rps_test
# Then prints the TEST_DATABASE_URL to export. Go DB tests, Postman and seeds for tests use
# rps_test only — never the developer's `rps` database.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="rps_test"

BASE_URL="${DATABASE_URL:-}"
if [ -z "$BASE_URL" ] && [ -f "$ROOT_DIR/.env" ]; then
  BASE_URL=$(grep -E '^DATABASE_URL=' "$ROOT_DIR/.env" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
fi
if [ -z "$BASE_URL" ]; then
  BASE_URL="postgres://rps_dev:rps_dev_password@localhost:5433/rps?sslmode=disable"
fi
with_db() { echo "$BASE_URL" | sed -E "s|/([^/?]+)(\\?.*)?$|/$1\\2|"; }
TEST_URL=$(with_db "$DB_NAME")
ADMIN_URL=$(with_db postgres)

case "$TEST_URL" in
  */rps_test\?*|*/rps_test) ;;
  *) echo "Error: refusing — computed test URL does not target rps_test" >&2; exit 1 ;;
esac

run_admin_sql() {
  if command -v psql >/dev/null 2>&1; then
    psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "$1"
  elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^rps_postgres$'; then
    docker exec -i rps_postgres psql -U rps_dev -d postgres -v ON_ERROR_STOP=1 -q -c "$1"
  else
    echo "Error: neither psql nor rps_postgres docker container available" >&2
    exit 1
  fi
}

echo "==> Recreating database '$DB_NAME'"
run_admin_sql "DROP DATABASE IF EXISTS $DB_NAME WITH (FORCE)"
run_admin_sql "CREATE DATABASE $DB_NAME"

echo "==> Migrating"
migrate -path "$ROOT_DIR/apps/backend/migrations" -database "$TEST_URL" up 2>&1 | sed -E 's|postgres://[^ ]+|<test db>|g'

echo "==> Seeding"
"$ROOT_DIR/scripts/seed-dev.sh" "$DB_NAME" >/dev/null

echo "✓ $DB_NAME ready. Export for DB tests / the test backend:"
echo "export TEST_DATABASE_URL='$TEST_URL'"
