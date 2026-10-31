package batch

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// Runs every read query against the real dev DB. Catches SELECT/Scan
// mismatches, missing columns (unapplied migrations), bad aliases, and
// NULL scanned into non-pointer fields. Skips when DATABASE_URL isn't set.
func TestReadQueriesSmoke(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	s := NewService(pool, "")

	list, err := s.List(ctx)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	t.Logf("List: %d batches", len(list))

	// D1: admin List must carry active_workers exactly when open logs exist at the current phase.
	for _, b := range list {
		var open int
		if err := pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM phase_logs
			WHERE batch_id = $1 AND phase = $2 AND completed_at IS NULL`, b.ID, b.CurrentPhase).Scan(&open); err != nil {
			t.Fatal(err)
		}
		if has := b.ActiveWorkers != nil && *b.ActiveWorkers != ""; has != (open > 0) {
			t.Errorf("List(%s): active_workers=%v but %d open logs", b.BatchCode, b.ActiveWorkers, open)
		}
	}

	if _, err := s.GetStats(ctx); err != nil {
		t.Fatalf("GetStats: %v", err)
	}

	for _, p := range []Phase{PhaseCutting, PhaseStitching, PhasePacking} {
		if _, err := s.ListByPhase(ctx, p, uuid.New()); err != nil {
			t.Fatalf("ListByPhase(%s): %v", p, err)
		}
	}

	// Rework queries smoke
	if _, err := s.ListReworkForStitcher(ctx, uuid.New()); err != nil {
		t.Fatalf("ListReworkForStitcher: %v", err)
	}
	if _, err := s.ListRework(ctx, "open", nil); err != nil {
		t.Fatalf("ListRework(open): %v", err)
	}
	if _, err := s.ListRework(ctx, "all", nil); err != nil {
		t.Fatalf("ListRework(all): %v", err)
	}
	adminRoute := "admin"
	if _, err := s.ListRework(ctx, "open", &adminRoute); err != nil {
		t.Fatalf("ListRework(open, admin): %v", err)
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

	// D4: list and detail must agree on unit roll-ups (incl. written-off), for every batch.
	for _, b := range list {
		d, err := s.Get(ctx, b.ID)
		if err != nil {
			t.Fatalf("Get(%s): %v", b.BatchCode, err)
		}
		if d.UnitsTotal != b.UnitsTotal || d.UnitsPacked != b.UnitsPacked ||
			d.UnitsStitched != b.UnitsStitched || d.UnitsWrittenOff != b.UnitsWrittenOff {
			t.Errorf("%s: list total/packed/stitched/off = %d/%d/%d/%d, detail = %d/%d/%d/%d", b.BatchCode,
				b.UnitsTotal, b.UnitsPacked, b.UnitsStitched, b.UnitsWrittenOff,
				d.UnitsTotal, d.UnitsPacked, d.UnitsStitched, d.UnitsWrittenOff)
		}
	}

	// Peek query smoke: unknown unit returns ErrUnitNotFound without panic
	if _, err := s.PeekUnit(ctx, "NONEXISTENT_UNIT_CODE", uuid.New()); !errors.Is(err, ErrUnitNotFound) {
		t.Fatalf("PeekUnit(unknown): expected ErrUnitNotFound, got %v", err)
	}
}
