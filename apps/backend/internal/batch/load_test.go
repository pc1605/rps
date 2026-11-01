package batch

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// TestStitcherLoads pins GET /stitchers/load: open mats per quota and shared pile,
// open batches, on-floor and today's output. Uses two throwaway stitchers and one batch.
func TestStitcherLoads(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	s := NewService(pool, t.TempDir())
	const ip = "127.0.0.1"

	var adminID, cutterID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM users LIMIT 1`).Scan(&adminID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT id FROM workers WHERE station='cutter' AND is_active LIMIT 1`).Scan(&cutterID); err != nil {
		t.Fatal(err)
	}
	sfx := time.Now().UnixNano()
	newStitcher := func(name string) uuid.UUID {
		t.Helper()
		var id uuid.UUID
		if err := pool.QueryRow(ctx, `
			INSERT INTO workers (name, station, badge_token, pin_hash, created_by)
			VALUES ($1, 'stitcher', $2, $3, $4) RETURNING id`,
			fmt.Sprintf("%s %d", name, sfx), fmt.Sprintf("t-load-%s-%d", name, sfx),
			"$2a$10$"+strings.Repeat("x", 53), adminID).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	a, b := newStitcher("A"), newStitcher("B")

	var groupID, carModelID int
	if err := pool.QueryRow(ctx, `INSERT INTO consumption_groups (name) VALUES ($1) RETURNING id`,
		fmt.Sprintf("T load %d", sfx)).Scan(&groupID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		INSERT INTO car_models (brand_id, name, size_class, pieces_per_set, product_line_id, consumption_group_id)
		SELECT (SELECT id FROM car_brands LIMIT 1), $1, 'medium', 4, (SELECT id FROM product_lines LIMIT 1), $2
		RETURNING id`, fmt.Sprintf("T load car %d", sfx), groupID).Scan(&carModelID); err != nil {
		t.Fatal(err)
	}
	bt, err := s.Create(ctx, CreateInput{CarModelID: carModelID, Quantity: 5}, adminID, "owner", ip)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(ctx, `DELETE FROM batches WHERE id = $1`, bt.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM workers WHERE id = ANY($1)`, []uuid.UUID{a, b})
		_, _ = pool.Exec(ctx, `DELETE FROM car_models WHERE id = $1`, carModelID)
		_, _ = pool.Exec(ctx, `DELETE FROM consumption_groups WHERE id = $1`, groupID)
	}()

	load := func() map[uuid.UUID]StitcherLoad {
		t.Helper()
		ls, err := s.StitcherLoads(ctx, time.Now())
		if err != nil {
			t.Fatalf("loads: %v", err)
		}
		m := map[uuid.UUID]StitcherLoad{}
		for _, l := range ls {
			m[l.WorkerID] = l
		}
		return m
	}

	if l := load()[a]; l.OpenMats != 0 || l.OpenBatches != 0 || l.OnFloor || l.LastScanAt != nil || l.MatsToday != 0 {
		t.Fatalf("idle stitcher: %+v", l)
	}

	if err := s.StartPhase(ctx, bt.ID, cutterID, "cutter", ip); err != nil {
		t.Fatalf("cut start: %v", err)
	}
	if err := s.CompletePhase(ctx, bt.ID, cutterID, "cutter", 5, "", ip); err != nil {
		t.Fatalf("cut complete: %v", err)
	}
	three, two := 3, 2
	if err := s.SetAssignments(ctx, bt.ID, PhaseStitching, []AssignmentInput{
		{WorkerID: a, TargetQty: &three}, {WorkerID: b, TargetQty: &two},
	}, adminID, ip); err != nil {
		t.Fatalf("assign: %v", err)
	}
	if err := s.StartPhase(ctx, bt.ID, a, "stitcher", ip); err != nil {
		t.Fatalf("join: %v", err)
	}
	d, err := s.Get(ctx, bt.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.ScanUnit(ctx, d.Units[0].UnitCode, a, "stitcher", ip); err != nil {
		t.Fatalf("scan: %v", err)
	}

	m := load()
	if l := m[a]; l.OpenMats != 2 || l.OpenBatches != 1 || !l.OnFloor || l.LastScanAt == nil || l.MatsToday != 1 {
		t.Fatalf("quota A: %+v", l)
	}
	if l := m[b]; l.OpenMats != 2 || l.OpenBatches != 1 || l.OnFloor || l.MatsToday != 0 {
		t.Fatalf("quota B: %+v", l)
	}

	// Shared pile: every assignee carries all 4 unstitched mats.
	if err := s.SetAssignments(ctx, bt.ID, PhaseStitching, []AssignmentInput{{WorkerID: a}, {WorkerID: b}}, adminID, ip); err != nil {
		t.Fatalf("shared pile: %v", err)
	}
	m = load()
	if m[a].OpenMats != 4 || m[b].OpenMats != 4 {
		t.Fatalf("shared pile: A=%+v B=%+v", m[a], m[b])
	}

	// Sort: least open work first — both tie at 4, A is on the floor so A comes before B.
	ls, _ := s.StitcherLoads(ctx, time.Now())
	ia, ib := -1, -1
	for i, l := range ls {
		switch l.WorkerID {
		case a:
			ia = i
		case b:
			ib = i
		}
	}
	if ia < 0 || ib < 0 || ia > ib {
		t.Fatalf("order: A at %d, B at %d", ia, ib)
	}
}
