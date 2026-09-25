package batch

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Runs every read query against the real dev DB. Catches SELECT/Scan
// mismatches, missing columns (unapplied migrations), bad aliases, and
// NULL scanned into non-pointer fields. Skips when DATABASE_URL isn't set.
func TestReadQueriesSmoke(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	s := NewService(pool)

	list, err := s.List(ctx)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	t.Logf("List: %d batches", len(list))

	if _, err := s.GetStats(ctx); err != nil {
		t.Fatalf("GetStats: %v", err)
	}

	for _, p := range []Phase{PhaseCutting, PhaseStitching, PhasePacking} {
		if _, err := s.ListByPhase(ctx, p, uuid.New()); err != nil {
			t.Fatalf("ListByPhase(%s): %v", p, err)
		}
	}

	// Exercise Get on one batch per phase, so every unit/timeline/assignment path runs
	seen := map[Phase]bool{}
	for _, b := range list {
		if seen[b.CurrentPhase] {
			continue
		}
		seen[b.CurrentPhase] = true
		if _, err := s.Get(ctx, b.ID); err != nil {
			t.Fatalf("Get(%s, %s): %v", b.BatchCode, b.CurrentPhase, err)
		}
	}
}
