#!/usr/bin/env bash
# Usage: scripts/review.sh [base]   (default: master)
set -u
BASE=${1:-master}
echo "== Commits";            git log --oneline "$BASE"..HEAD
echo; echo "== Files changed";  git diff --stat "$BASE"...HEAD | tail -40
echo; echo "== Sensitive areas (backend / ui primitives / env / lockfile / migrations)"
git diff --name-status "$BASE"...HEAD | grep -E "apps/backend/|components/ui/|\.env|pnpm-lock|migrations/" || echo "  none"
echo; echo "== Red flags added"
git diff "$BASE"...HEAD -U0 | grep -E '^\+' | grep -nE \
  'as any|: any\b|@ts-ignore|@ts-expect-error|biome-ignore|eslint-disable|nolint|console\.(log|trace)|t\.Skip|\.skip\(|catch \{\}' \
  || echo "  none"
echo; echo "== Removed checks/tests"
git diff "$BASE"...HEAD -U0 | grep -E '^-' | grep -nE 'throw |errors\.Is|preventDefault|t\.Fatal|expect\(|_test\.go' | head -40 || true
echo; echo "== Migrations: modified existing ones? (must be none)"
git diff --name-status "$BASE"...HEAD -- apps/backend/migrations/ | grep -E '^M' || echo "  none ✓"
echo; echo "== New dependencies"
git diff "$BASE"...HEAD -- '**/package.json' 'apps/backend/go.mod' | grep -E '^\+\s' | grep -vE '"scripts"|typecheck|lint' || echo "  none"
