#!/usr/bin/env bash
set -euo pipefail

# scripts/seed-dev.sh
# Complete self-sufficient seed pipeline for development:
# 1. Base entities (owner, rolls, basic models) via go run ./cmd/seed
# 2. Complete catalogue with product lines and barcodes via seeds/01-catalog.sql
# 3. Demo batches across realistic lifecycle states via seeds/02-demo.sql
# 4. Rework placeholder image via scripts/seed-uploads.sh

DB_NAME="${1:-rps}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BASE_URL="${DATABASE_URL:-}"
if [ -z "$BASE_URL" ] && [ -f "$ROOT_DIR/.env" ]; then
  BASE_URL=$(grep -E '^DATABASE_URL=' "$ROOT_DIR/.env" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
fi
if [ -z "$BASE_URL" ]; then
  BASE_URL="postgres://rps_dev:rps_dev_password@localhost:5433/rps?sslmode=disable"
fi

# Replace database name in URL with $DB_NAME
TARGET_DB_URL=$(echo "$BASE_URL" | sed -E "s|/([^/?]+)(\\?.*)?$|/${DB_NAME}\\2|")

echo "==> Seeding database '$DB_NAME'..."

# 1. Base seed (Go)
echo "--> Step 1: go run ./cmd/seed"
(cd "$ROOT_DIR/apps/backend" && DATABASE_URL="$TARGET_DB_URL" go run ./cmd/seed)

# Helper to execute SQL scripts
run_sql() {
  local sql_file="$1"
  if command -v psql >/dev/null 2>&1; then
    psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$sql_file"
  elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^rps_postgres$'; then
    docker exec -i rps_postgres psql -U rps_dev -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$sql_file"
  else
    echo "Error: neither psql nor rps_postgres docker container available" >&2
    exit 1
  fi
}

# 2. Catalogue seed
echo "--> Step 2: seeds/01-catalog.sql"
run_sql "$ROOT_DIR/seeds/01-catalog.sql"

# 3. Demo seed
echo "--> Step 3: seeds/02-demo.sql"
run_sql "$ROOT_DIR/seeds/02-demo.sql"

# 4. Uploads
echo "--> Step 4: scripts/seed-uploads.sh"
"$ROOT_DIR/scripts/seed-uploads.sh"

echo "✓ Successfully seeded '$DB_NAME' with full catalogue and demo lifecycle data."
