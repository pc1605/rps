#!/usr/bin/env bash
set -euo pipefail

# scripts/seed-uploads.sh
# Copies fixture image to $UPLOAD_DIR/rework/seed-placeholder.jpg for seeded rework demo data.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="$ROOT_DIR/postman/fixtures/fault.jpg"

if [ ! -f "$FIXTURE" ]; then
  echo "Error: fixture image not found at $FIXTURE" >&2
  exit 1
fi

UPLOAD_DIR="${UPLOAD_DIR:-}"
if [ -z "$UPLOAD_DIR" ] && [ -f "$ROOT_DIR/.env" ]; then
  UPLOAD_DIR=$(grep -E '^UPLOAD_DIR=' "$ROOT_DIR/.env" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
fi

if [ -z "$UPLOAD_DIR" ]; then
  UPLOAD_DIR="./uploads"
fi

if [[ "$UPLOAD_DIR" != /* ]]; then
  UPLOAD_DIR="$ROOT_DIR/$UPLOAD_DIR"
fi

mkdir -p "$UPLOAD_DIR/rework"
cp "$FIXTURE" "$UPLOAD_DIR/rework/seed-placeholder.jpg"

if [ -d "$ROOT_DIR/apps/backend" ] && [ "$UPLOAD_DIR" != "$ROOT_DIR/apps/backend/uploads" ]; then
  mkdir -p "$ROOT_DIR/apps/backend/uploads/rework"
  cp "$FIXTURE" "$ROOT_DIR/apps/backend/uploads/rework/seed-placeholder.jpg"
fi

echo "✓ Seed placeholder installed at: $UPLOAD_DIR/rework/seed-placeholder.jpg"
