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

func TestRouteFor(t *testing.T) {
	tests := []struct {
		name        string
		round       int
		reasons     []string
		hasStitcher bool
		want        string
	}{
		{
			name:        "round 1 stitching fault with stitcher",
			round:       1,
			reasons:     []string{"stitching_fault"},
			hasStitcher: true,
			want:        "stitcher",
		},
		{
			name:        "round 1 stain with stitcher",
			round:       1,
			reasons:     []string{"stain"},
			hasStitcher: true,
			want:        "stitcher",
		},
		{
			name:        "round 1 other with stitcher",
			round:       1,
			reasons:     []string{"other"},
			hasStitcher: true,
			want:        "stitcher",
		},
		{
			name:        "round 1 cutting fault routes to admin",
			round:       1,
			reasons:     []string{"cutting_fault"},
			hasStitcher: true,
			want:        "admin",
		},
		{
			name:        "round 1 material defect routes to admin",
			round:       1,
			reasons:     []string{"material_defect"},
			hasStitcher: true,
			want:        "admin",
		},
		{
			name:        "round 1 mixed containing material defect routes to admin",
			round:       1,
			reasons:     []string{"stitching_fault", "material_defect"},
			hasStitcher: true,
			want:        "admin",
		},
		{
			name:        "round 1 without stitcher routes to admin",
			round:       1,
			reasons:     []string{"stitching_fault"},
			hasStitcher: false,
			want:        "admin",
		},
		{
			name:        "round 2 always routes to admin",
			round:       2,
			reasons:     []string{"stitching_fault"},
			hasStitcher: true,
			want:        "admin",
		},
		{
			name:        "round 3 always routes to admin",
			round:       3,
			reasons:     []string{"stain"},
			hasStitcher: true,
			want:        "admin",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := routeFor(tt.round, tt.reasons, tt.hasStitcher)
			if got != tt.want {
				t.Errorf("routeFor(%d, %v, %v) = %q, want %q", tt.round, tt.reasons, tt.hasStitcher, got, tt.want)
			}
		})
	}
}

func TestReworkFlow(t *testing.T) {
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

	// Fetch required reference entities
	var adminID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM users LIMIT 1`).Scan(&adminID); err != nil {
		t.Fatalf("query admin user: %v", err)
	}

	var stitcherID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM workers WHERE station = 'stitcher' LIMIT 1`).Scan(&stitcherID); err != nil {
		t.Fatalf("query stitcher: %v", err)
	}

	var packerID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM workers WHERE station = 'packer' LIMIT 1`).Scan(&packerID); err != nil {
		t.Fatalf("query packer: %v", err)
	}

	var carModelID int
	if err := pool.QueryRow(ctx, `SELECT id FROM car_models LIMIT 1`).Scan(&carModelID); err != nil {
		t.Fatalf("query car model: %v", err)
	}

	// 1. Create a batch of 2
	b, err := s.Create(ctx, CreateInput{
		CarModelID: carModelID,
		Quantity:   2,
	}, adminID, "owner", "127.0.0.1")
	if err != nil {
		t.Fatalf("create batch: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(ctx, `DELETE FROM batches WHERE id = $1`, b.ID)
	}()

	// 2. Simulate stitched units + advancing batch to packing in_progress
	if _, err := pool.Exec(ctx, `
		UPDATE batch_units SET stitched_by = $1, stitched_at = NOW() WHERE batch_id = $2
	`, stitcherID, b.ID); err != nil {
		t.Fatalf("update stitched units: %v", err)
	}

	if _, err := pool.Exec(ctx, `
		UPDATE batches SET current_phase = 'packing', status = 'in_progress', version = version + 1 WHERE id = $1
	`, b.ID); err != nil {
		t.Fatalf("advance batch to packing: %v", err)
	}

	// Packer joins the batch
	if _, err := pool.Exec(ctx, `
		INSERT INTO phase_logs (batch_id, phase, worker_id, started_at)
		VALUES ($1, 'packing', $2, NOW())
	`, b.ID, packerID); err != nil {
		t.Fatalf("packer join phase log: %v", err)
	}

	detail, err := s.Get(ctx, b.ID)
	if err != nil {
		t.Fatalf("get batch: %v", err)
	}
	if len(detail.Units) != 2 {
		t.Fatalf("expected 2 units, got %d", len(detail.Units))
	}
	unit1 := detail.Units[0]
	unit2 := detail.Units[1]

	dummyPhoto := filepath.Join(tempUpload, "sample.jpg")
	if err := os.WriteFile(dummyPhoto, []byte("fake-photo-data"), 0600); err != nil {
		t.Fatalf("write dummy photo: %v", err)
	}

	// 3. Flag unit 1 with reasons [stitching_fault] → route stitcher
	rw1, err := s.FlagRework(ctx, unit1.UnitCode, packerID, "packer", []string{"stitching_fault"}, nil, []string{dummyPhoto}, "127.0.0.1")
	if err != nil {
		t.Fatalf("flag rework round 1: %v", err)
	}
	if rw1.Route != "stitcher" {
		t.Errorf("expected route stitcher, got %s", rw1.Route)
	}
	if rw1.Round != 1 {
		t.Errorf("expected round 1, got %d", rw1.Round)
	}

	// Assert unit status rework, batch rework_count 1
	var u1Status UnitStatus
	if err := pool.QueryRow(ctx, `SELECT status FROM batch_units WHERE id = $1`, unit1.ID).Scan(&u1Status); err != nil {
		t.Fatal(err)
	}
	if u1Status != UnitRework {
		t.Errorf("expected unit status rework, got %s", u1Status)
	}

	var reworkCount int
	if err := pool.QueryRow(ctx, `SELECT rework_count FROM batches WHERE id = $1`, b.ID).Scan(&reworkCount); err != nil {
		t.Fatal(err)
	}
	if reworkCount != 1 {
		t.Errorf("expected rework_count 1, got %d", reworkCount)
	}

	// 4. Second flag of same unit blocked while open
	_, err = s.FlagRework(ctx, unit1.UnitCode, packerID, "packer", []string{"stain"}, nil, []string{dummyPhoto}, "127.0.0.1")
	if err == nil || !errors.Is(err, ErrAlreadyInRework) {
		t.Fatalf("expected ErrAlreadyInRework on duplicate open rework flag, got: %v", err)
	}

	// Packer scanning rework unit is blocked
	_, err = s.ScanUnit(ctx, unit1.UnitCode, packerID, "packer", "127.0.0.1")
	if err == nil || !errors.Is(err, ErrInRework) {
		t.Fatalf("expected ErrInRework when packer scans rework unit, got: %v", err)
	}

	// 5. Fix via stitcher scan → unit back to pending, round closed
	scanRes, err := s.ScanUnit(ctx, unit1.UnitCode, stitcherID, "stitcher", "127.0.0.1")
	if err != nil {
		t.Fatalf("stitcher scan rework fix: %v", err)
	}
	if !scanRes.ReworkFixed {
		t.Errorf("expected rework_fixed to be true")
	}

	if err := pool.QueryRow(ctx, `SELECT status FROM batch_units WHERE id = $1`, unit1.ID).Scan(&u1Status); err != nil {
		t.Fatal(err)
	}
	if u1Status != UnitPending {
		t.Errorf("expected unit status pending after fix, got %s", u1Status)
	}

	var fixedAt *time.Time
	if err := pool.QueryRow(ctx, `SELECT fixed_at FROM rework_logs WHERE id = $1`, rw1.ID).Scan(&fixedAt); err != nil {
		t.Fatal(err)
	}
	if fixedAt == nil {
		t.Errorf("expected fixed_at to be populated")
	}

	// 6. Flag again → round 2 → route admin
	rw2, err := s.FlagRework(ctx, unit1.UnitCode, packerID, "packer", []string{"stitching_fault"}, nil, []string{dummyPhoto}, "127.0.0.1")
	if err != nil {
		t.Fatalf("flag rework round 2: %v", err)
	}
	if rw2.Round != 2 {
		t.Errorf("expected round 2, got %d", rw2.Round)
	}
	if rw2.Route != "admin" {
		t.Errorf("expected route admin for round 2, got %s", rw2.Route)
	}

	// Stitcher scanning undecided admin rework is blocked
	_, err = s.ScanUnit(ctx, unit1.UnitCode, stitcherID, "stitcher", "127.0.0.1")
	if err == nil || !errors.Is(err, ErrReworkPendingDecision) {
		t.Fatalf("expected ErrReworkPendingDecision, got: %v", err)
	}

	// 7. Admin decides write_off → unit defective
	decRes, err := s.DecideRework(ctx, rw2.ID, "write_off", nil, adminID, "127.0.0.1")
	if err != nil {
		t.Fatalf("decide write_off: %v", err)
	}
	if decRes.Decision == nil || *decRes.Decision != "write_off" {
		t.Errorf("expected decision write_off, got %v", decRes.Decision)
	}

	if err := pool.QueryRow(ctx, `SELECT status FROM batch_units WHERE id = $1`, unit1.ID).Scan(&u1Status); err != nil {
		t.Fatal(err)
	}
	if u1Status != UnitDefective {
		t.Errorf("expected unit status defective, got %s", u1Status)
	}

	// Packer scanning written-off / defective unit must receive ErrUnitWrittenOff
	_, err = s.ScanUnit(ctx, unit1.UnitCode, packerID, "packer", "127.0.0.1")
	if err == nil || !errors.Is(err, ErrUnitWrittenOff) {
		t.Fatalf("expected ErrUnitWrittenOff when packer scans written-off unit, got: %v", err)
	}

	// 8. Pack unit 2 → batch completes
	packRes, err := s.ScanUnit(ctx, unit2.UnitCode, packerID, "packer", "127.0.0.1")
	if err != nil {
		t.Fatalf("pack unit 2: %v", err)
	}
	if !packRes.BatchCompleted {
		t.Errorf("expected batch_completed to be true")
	}

	var batchStatus Status
	if err := pool.QueryRow(ctx, `SELECT status FROM batches WHERE id = $1`, b.ID).Scan(&batchStatus); err != nil {
		t.Fatal(err)
	}
	if batchStatus != StatusCompleted {
		t.Errorf("expected batch status completed, got %s", batchStatus)
	}
}
