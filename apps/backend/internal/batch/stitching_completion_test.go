package batch

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TestStitchingCompletionRule pins the rule:
//   - a batch leaves stitching only when every unit has stitched_at, and
//     stitched_at is set only by a normal stitching scan (ScanUnit);
//   - duplicate scans, manual completion, rework flags, rework fixes and
//     write-offs never change stitching progress.
//
// Runs against DATABASE_URL (skipped otherwise); creates one throwaway batch
// and deletes it (children cascade).
func TestStitchingCompletionRule(t *testing.T) {
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

	tempUpload := t.TempDir()
	s := NewService(pool, tempUpload)
	const ip = "127.0.0.1"

	one := func(q string, dst any) {
		t.Helper()
		if err := pool.QueryRow(ctx, q).Scan(dst); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	var adminID, cutterID, stitcherID, packerID uuid.UUID
	var carModelID int
	one(`SELECT id FROM users LIMIT 1`, &adminID)
	one(`SELECT id FROM workers WHERE station='cutter' AND is_active LIMIT 1`, &cutterID)
	one(`SELECT id FROM workers WHERE station='stitcher' AND is_active LIMIT 1`, &stitcherID)
	one(`SELECT id FROM workers WHERE station='packer' AND is_active LIMIT 1`, &packerID)
	one(`SELECT id FROM car_models LIMIT 1`, &carModelID)

	b, err := s.Create(ctx, CreateInput{CarModelID: carModelID, Quantity: 3}, adminID, "owner", ip)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	defer func() { _, _ = pool.Exec(ctx, `DELETE FROM batches WHERE id = $1`, b.ID) }()

	phaseOf := func() (Phase, Status) {
		t.Helper()
		var p Phase
		var st Status
		if err := pool.QueryRow(ctx, `SELECT current_phase, status FROM batches WHERE id=$1`, b.ID).Scan(&p, &st); err != nil {
			t.Fatal(err)
		}
		return p, st
	}
	stitchedCount := func() int {
		t.Helper()
		var n int
		if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM batch_units WHERE batch_id=$1 AND stitched_at IS NOT NULL`, b.ID).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	stitchFacts := func(unitID uuid.UUID) (*uuid.UUID, *time.Time) {
		t.Helper()
		var by *uuid.UUID
		var at *time.Time
		if err := pool.QueryRow(ctx, `SELECT stitched_by, stitched_at FROM batch_units WHERE id=$1`, unitID).Scan(&by, &at); err != nil {
			t.Fatal(err)
		}
		return by, at
	}
	mustStitching := func(step string) {
		t.Helper()
		if p, _ := phaseOf(); p != PhaseStitching {
			t.Fatalf("%s: batch left stitching early (phase=%s, stitched=%d/3)", step, p, stitchedCount())
		}
	}

	// Real path to stitching: cut all 3 → assign (uncapped) → join.
	if err := s.StartPhase(ctx, b.ID, cutterID, "cutter", ip); err != nil {
		t.Fatalf("cutter start: %v", err)
	}
	if err := s.CompletePhase(ctx, b.ID, cutterID, "cutter", 3, "", ip); err != nil {
		t.Fatalf("cutter complete: %v", err)
	}
	if err := s.SetAssignments(ctx, b.ID, PhaseStitching, []AssignmentInput{{WorkerID: stitcherID}}, adminID, ip); err != nil {
		t.Fatalf("assign: %v", err)
	}
	if err := s.StartPhase(ctx, b.ID, stitcherID, "stitcher", ip); err != nil {
		t.Fatalf("stitcher join: %v", err)
	}

	d, err := s.Get(ctx, b.ID)
	if err != nil || len(d.Units) != 3 {
		t.Fatalf("get: %v (units=%d)", err, len(d.Units))
	}
	u1, u2, u3 := d.Units[0], d.Units[1], d.Units[2]

	// 1. First scan counts; batch stays in stitching.
	r, err := s.ScanUnit(ctx, u1.UnitCode, stitcherID, "stitcher", ip)
	if err != nil {
		t.Fatalf("scan u1: %v", err)
	}
	if r.DoneCount != 1 || r.TotalUnits != 3 || r.PhaseCompleted {
		t.Fatalf("scan u1: got done=%d total=%d completed=%v", r.DoneCount, r.TotalUnits, r.PhaseCompleted)
	}
	mustStitching("after u1")

	// 2. Duplicate scan is idempotent: no progress.
	r, err = s.ScanUnit(ctx, u1.UnitCode, stitcherID, "stitcher", ip)
	if err != nil || !r.AlreadyDone || r.DoneCount != 1 {
		t.Fatalf("rescan u1: err=%v alreadyDone=%v done=%d", err, r != nil && r.AlreadyDone, r.DoneCount)
	}

	// 3. Manual completion is refused for stitching.
	if err := s.CompletePhase(ctx, b.ID, stitcherID, "stitcher", 3, "", ip); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("manual stitching complete: want ErrInvalidInput, got %v", err)
	}
	mustStitching("after manual complete attempt")

	// 4. Rework cannot be flagged while the batch is in stitching.
	photo := filepath.Join(tempUpload, "p.jpg")
	if err := os.WriteFile(photo, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := s.FlagRework(ctx, u2.UnitCode, packerID, "packer", []string{"stitching_fault"}, nil, []string{photo}, ip); !errors.Is(err, ErrWrongPhase) {
		t.Fatalf("flag during stitching: want ErrWrongPhase, got %v", err)
	}

	// 5. A defective unit is refused and never counted as stitched.
	if _, err := pool.Exec(ctx, `UPDATE batch_units SET status='defective' WHERE id=$1`, u3.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ScanUnit(ctx, u3.UnitCode, stitcherID, "stitcher", ip); !errors.Is(err, ErrUnitWrittenOff) {
		t.Fatalf("scan defective: want ErrUnitWrittenOff, got %v", err)
	}
	if n := stitchedCount(); n != 1 {
		t.Fatalf("defective unit changed stitching progress: stitched=%d, want 1", n)
	}
	mustStitching("after defective scan")
	if _, err := pool.Exec(ctx, `UPDATE batch_units SET status='pending' WHERE id=$1`, u3.ID); err != nil {
		t.Fatal(err)
	}

	// 6. Only when the last unit is scanned does the batch advance.
	if r, err = s.ScanUnit(ctx, u2.UnitCode, stitcherID, "stitcher", ip); err != nil || r.PhaseCompleted {
		t.Fatalf("scan u2: err=%v completed=%v", err, r != nil && r.PhaseCompleted)
	}
	mustStitching("after u2")
	if r, err = s.ScanUnit(ctx, u3.UnitCode, stitcherID, "stitcher", ip); err != nil || !r.PhaseCompleted || r.DoneCount != 3 {
		t.Fatalf("scan u3 (last): err=%v completed=%v done=%d", err, r != nil && r.PhaseCompleted, r.DoneCount)
	}
	if p, st := phaseOf(); p != PhasePacking || st != StatusPending {
		t.Fatalf("after last scan: want packing/pending, got %s/%s", p, st)
	}
	var qty *int
	if err := pool.QueryRow(ctx, `SELECT quantity_completed FROM phase_logs WHERE batch_id=$1 AND phase='stitching' AND worker_id=$2`, b.ID, stitcherID).Scan(&qty); err != nil || qty == nil || *qty != 3 {
		t.Fatalf("stitching log close: err=%v qty=%v, want 3", err, qty)
	}

	// 7. In packing: a rework fix and a write-off leave stitch facts untouched.
	by1, at1 := stitchFacts(u1.ID)
	by2, at2 := stitchFacts(u2.ID)
	if err := s.StartPhase(ctx, b.ID, packerID, "packer", ip); err != nil {
		t.Fatalf("packer join: %v", err)
	}
	if _, err := s.FlagRework(ctx, u1.UnitCode, packerID, "packer", []string{"stitching_fault"}, nil, []string{photo}, ip); err != nil {
		t.Fatalf("flag u1: %v", err)
	}
	if r, err = s.ScanUnit(ctx, u1.UnitCode, stitcherID, "stitcher", ip); err != nil || !r.ReworkFixed {
		t.Fatalf("fix u1: err=%v fixed=%v", err, r != nil && r.ReworkFixed)
	}
	rw, err := s.FlagRework(ctx, u2.UnitCode, packerID, "packer", []string{"cutting_fault"}, nil, []string{photo}, ip)
	if err != nil {
		t.Fatalf("flag u2: %v", err)
	}
	if _, err := s.DecideRework(ctx, rw.ID, "write_off", nil, adminID, ip); err != nil {
		t.Fatalf("write off u2: %v", err)
	}
	for _, c := range []struct {
		name string
		id   uuid.UUID
		by   *uuid.UUID
		at   *time.Time
	}{{"u1 (rework fixed)", u1.ID, by1, at1}, {"u2 (written off)", u2.ID, by2, at2}} {
		by, at := stitchFacts(c.id)
		if by == nil || c.by == nil || *by != *c.by || at == nil || c.at == nil || !at.Equal(*c.at) {
			t.Errorf("%s: stitched_by/at changed (%v %v → %v %v)", c.name, c.by, c.at, by, at)
		}
	}
	if n := stitchedCount(); n != 3 {
		t.Errorf("stitched count changed in packing: %d, want 3", n)
	}
	if p, _ := phaseOf(); p != PhasePacking {
		t.Errorf("rework/write-off moved batch out of packing: %s", p)
	}
}
