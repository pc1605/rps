// Package testutil gives DB tests an isolated database.
//
// DB tests NEVER use DATABASE_URL (the developer's real `rps` DB). They read
// TEST_DATABASE_URL — create it with scripts/test-db.sh — and skip when it is
// unset or unreachable.
package testutil

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// EnvVar names the test database URL.
const EnvVar = "TEST_DATABASE_URL"

// advisoryKey serialises DB tests across packages (go test ./... runs packages in parallel).
const advisoryKey = 727001

// Tables whose row counts must be identical before and after every DB test.
// audit_log (append-only by design) and batch_code_counters (updated, never inserted) are excluded.
var trackedTables = []string{
	"batches", "batch_units", "phase_logs", "batch_assignments", "rework_logs", "rework_photos",
	"car_models", "car_brands", "product_lines", "consumption_groups", "car_material_overrides",
	"recipes", "recipe_lines", "material_types", "material_variants", "material_lots",
	"material_movements", "batch_material_plan", "workers", "users",
}

// DB returns a pool on TEST_DATABASE_URL. It skips the test when the variable is unset or
// the database is unreachable, refuses a database named "rps", holds an advisory lock for
// the test's duration, and fails the test if it leaves rows behind in any tracked table.
func DB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv(EnvVar)
	if url == "" {
		t.Skipf("%s not set (run scripts/test-db.sh)", EnvVar)
	}
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatalf("%s: %v", EnvVar, err)
	}
	if strings.EqualFold(cfg.ConnConfig.Database, "rps") {
		t.Fatalf("%s points at the dev database 'rps' — tests must use rps_test (scripts/test-db.sh)", EnvVar)
	}
	cfg.MaxConns = 16

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err == nil {
		err = pool.Ping(ctx)
	}
	if err != nil {
		if pool != nil {
			pool.Close()
		}
		t.Skipf("test database unreachable (%v) — run scripts/test-db.sh", err)
	}

	lockConn, err := pool.Acquire(context.Background())
	if err != nil {
		pool.Close()
		t.Fatalf("acquire lock conn: %v", err)
	}
	if _, err := lockConn.Exec(context.Background(), `SELECT pg_advisory_lock($1)`, advisoryKey); err != nil {
		lockConn.Release()
		pool.Close()
		t.Fatalf("advisory lock: %v", err)
	}

	before := counts(t, pool)
	// Registered first → runs last, after the test's own cleanups.
	t.Cleanup(func() {
		after := counts(t, pool)
		for _, tbl := range trackedTables {
			if after[tbl] != before[tbl] {
				t.Errorf("test left rows behind: %s %d → %d", tbl, before[tbl], after[tbl])
			}
		}
		_, _ = lockConn.Exec(context.Background(), `SELECT pg_advisory_unlock($1)`, advisoryKey)
		lockConn.Release()
		pool.Close()
	})
	return pool
}

func counts(t *testing.T, pool *pgxpool.Pool) map[string]int64 {
	t.Helper()
	parts := make([]string, len(trackedTables))
	for i, tbl := range trackedTables {
		parts[i] = fmt.Sprintf("(SELECT COUNT(*) FROM %s)", tbl)
	}
	vals := make([]int64, len(trackedTables))
	dst := make([]any, len(vals))
	for i := range vals {
		dst[i] = &vals[i]
	}
	if err := pool.QueryRow(context.Background(), "SELECT "+strings.Join(parts, ", ")).Scan(dst...); err != nil {
		t.Fatalf("row counts: %v", err)
	}
	out := make(map[string]int64, len(trackedTables))
	for i, tbl := range trackedTables {
		out[tbl] = vals[i]
	}
	return out
}
