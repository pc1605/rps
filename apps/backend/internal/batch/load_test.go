package batch

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

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

	carModelID := testCar(t, pool, "load")
	bt, err := s.Create(ctx, CreateInput{CarModelID: carModelID, Quantity: 5}, adminID, "owner", ip)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(ctx, `DELETE FROM batches WHERE id = $1`, bt.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM workers WHERE id = ANY($1)`, []uuid.UUID{a, b})
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

// testCar inserts an isolated car model in a consumption group with no recipe (a cut consumes
// no seed stock) and removes both when the test ends. Delete the test's batches first.
func testCar(t *testing.T, pool *pgxpool.Pool, tag string) int {
	t.Helper()
	ctx := context.Background()
	sfx := time.Now().UnixNano()
	var groupID, carModelID int
	if err := pool.QueryRow(ctx, `INSERT INTO consumption_groups (name) VALUES ($1) RETURNING id`,
		fmt.Sprintf("T %s %d", tag, sfx)).Scan(&groupID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		INSERT INTO car_models (brand_id, name, size_class, pieces_per_set, product_line_id, consumption_group_id)
		SELECT (SELECT id FROM car_brands LIMIT 1), $1, 'medium', 4, (SELECT id FROM product_lines LIMIT 1), $2
		RETURNING id`, fmt.Sprintf("T %s car %d", tag, sfx), groupID).Scan(&carModelID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM car_models WHERE id = $1`, carModelID)
		_, _ = pool.Exec(ctx, `DELETE FROM consumption_groups WHERE id = $1`, groupID)
	})
	return carModelID
}

// TestReadySince pins ready_since on GET /batches and sort=waiting: set only while
// awaiting_assignment, from the latest event into that status.
func TestReadySince(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	s := NewService(pool, t.TempDir())
	const ip = "127.0.0.1"
	var adminID, cutterID, stitcherID uuid.UUID
	for q, dst := range map[string]*uuid.UUID{
		`SELECT id FROM users LIMIT 1`:                                          &adminID,
		`SELECT id FROM workers WHERE station='cutter' AND is_active LIMIT 1`:   &cutterID,
		`SELECT id FROM workers WHERE station='stitcher' AND is_active LIMIT 1`: &stitcherID,
	} {
		if err := pool.QueryRow(ctx, q).Scan(dst); err != nil {
			t.Fatal(err)
		}
	}
	carModelID := testCar(t, pool, "ready")
	bt, err := s.Create(ctx, CreateInput{CarModelID: carModelID, Quantity: 2}, adminID, "owner", ip)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	defer func() { _, _ = pool.Exec(ctx, `DELETE FROM batches WHERE id = $1`, bt.ID) }()

	find := func(view string) *Batch {
		t.Helper()
		pg, err := s.ListPage(ctx, ListFilter{View: view, Q: bt.BatchCode})
		if err != nil {
			t.Fatal(err)
		}
		for i := range pg.Items {
			if pg.Items[i].ID == bt.ID {
				return &pg.Items[i]
			}
		}
		return nil
	}
	eventAt := func() time.Time {
		t.Helper()
		var at time.Time
		if err := pool.QueryRow(ctx, `SELECT MAX(at) FROM batch_events
			WHERE batch_id = $1 AND to_status = 'awaiting_assignment'`, bt.ID).Scan(&at); err != nil {
			t.Fatal(err)
		}
		return at
	}

	if b := find("cutting"); b == nil || b.ReadySince != nil {
		t.Fatalf("cutting: want no ready_since, got %+v", b)
	}
	if err := s.StartPhase(ctx, bt.ID, cutterID, "cutter", ip); err != nil {
		t.Fatal(err)
	}
	if err := s.CompletePhase(ctx, bt.ID, cutterID, "cutter", 2, "", ip); err != nil {
		t.Fatal(err)
	}
	b := find("ready")
	if b == nil || b.ReadySince == nil || !b.ReadySince.Equal(eventAt()) {
		t.Fatalf("after cut: ready_since %v, event %v", b, eventAt())
	}
	cutAt := *b.ReadySince

	if err := s.SetAssignments(ctx, bt.ID, PhaseStitching, []AssignmentInput{{WorkerID: stitcherID}}, adminID, ip); err != nil {
		t.Fatal(err)
	}
	if b := find("stitching"); b == nil || b.ReadySince != nil {
		t.Fatalf("assigned: want no ready_since, got %+v", b)
	}
	// Clearing the assignment parks it again: waiting restarts from that event.
	if err := s.SetAssignments(ctx, bt.ID, PhaseStitching, nil, adminID, ip); err != nil {
		t.Fatal(err)
	}
	if b := find("ready"); b == nil || b.ReadySince == nil || !b.ReadySince.After(cutAt) {
		t.Fatalf("cleared: ready_since should move past %v, got %+v", cutAt, b)
	}

	// sort=waiting asc: oldest first, non-waiting batches last.
	pg, err := s.ListPage(ctx, ListFilter{Sort: "waiting"})
	if err != nil {
		t.Fatal(err)
	}
	seenNil := false
	var prev *time.Time
	for _, it := range pg.Items {
		if it.ReadySince == nil {
			seenNil = true
			continue
		}
		if seenNil {
			t.Fatal("sort=waiting: a waiting batch sorted after a non-waiting one")
		}
		if prev != nil && it.ReadySince.Before(*prev) {
			t.Fatal("sort=waiting: not oldest first")
		}
		prev = it.ReadySince
	}
}
