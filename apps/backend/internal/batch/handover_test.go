package batch

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// TestHandOver pins POST /stitching/hand-over and GET /stitchers/:id/open:
// quota and shared-pile moves, removal of a stitcher who did nothing, the guards, and
// all-or-nothing across batches.
func TestHandOver(t *testing.T) {
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
	stitcher := func(name string) uuid.UUID {
		t.Helper()
		var id uuid.UUID
		if err := pool.QueryRow(ctx, `
			INSERT INTO workers (name, station, badge_token, pin_hash, created_by)
			VALUES ($1, 'stitcher', $2, $3, $4) RETURNING id`,
			fmt.Sprintf("%s %d", name, sfx), fmt.Sprintf("t-hand-%s-%d", name, sfx),
			"$2a$10$"+strings.Repeat("x", 53), adminID).Scan(&id); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM workers WHERE id = $1`, id) })
		return id
	}
	a, b, c := stitcher("A"), stitcher("B"), stitcher("C")
	car := testCar(t, pool, "hand")

	// newBatch: qty mats, cut in full (or left in cutting), registered for cleanup before workers.
	newBatch := func(qty int, cut bool) (uuid.UUID, string) {
		t.Helper()
		bt, err := s.Create(ctx, CreateInput{CarModelID: car, Quantity: qty}, adminID, "owner", ip)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM batches WHERE id = $1`, bt.ID) })
		if cut {
			if err := s.StartPhase(ctx, bt.ID, cutterID, "cutter", ip); err != nil {
				t.Fatal(err)
			}
			if err := s.CompletePhase(ctx, bt.ID, cutterID, "cutter", qty, "", ip); err != nil {
				t.Fatal(err)
			}
		}
		return bt.ID, bt.BatchCode
	}
	targets := func(batchID uuid.UUID) map[uuid.UUID]*int {
		t.Helper()
		rows, err := pool.Query(ctx, `SELECT worker_id, target_qty FROM batch_assignments
			WHERE batch_id=$1 AND phase='stitching'`, batchID)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		m := map[uuid.UUID]*int{}
		for rows.Next() {
			var w uuid.UUID
			var q *int
			if err := rows.Scan(&w, &q); err != nil {
				t.Fatal(err)
			}
			m[w] = q
		}
		return m
	}
	n := func(v int) *int { return &v }
	is := func(p *int, v int) bool { return p != nil && *p == v }
	mustInvalid := func(step string, err error) {
		t.Helper()
		if !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("%s: want ErrInvalidInput, got %v", step, err)
		}
	}

	// ── Quota batch: A 3 / B 2, A stitches 1, A → B moves 2 ──
	q, qCode := newBatch(5, true)
	if err := s.SetAssignments(ctx, q, PhaseStitching, []AssignmentInput{
		{WorkerID: a, TargetQty: n(3)}, {WorkerID: b, TargetQty: n(2)}}, adminID, ip); err != nil {
		t.Fatal(err)
	}
	if err := s.StartPhase(ctx, q, a, "stitcher", ip); err != nil {
		t.Fatal(err)
	}
	d, err := s.Get(ctx, q)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.ScanUnit(ctx, d.Units[0].UnitCode, a, "stitcher", ip); err != nil {
		t.Fatal(err)
	}

	open, err := s.OpenStitchingFor(ctx, a)
	if err != nil || len(open) != 1 || open[0].BatchID != q || !is(open[0].TargetQty, 3) || open[0].DoneQty != 1 || open[0].LeftQty != 2 {
		t.Fatalf("open for A: %+v %v", open, err)
	}

	res, err := s.HandOver(ctx, a, []HandOverMove{{BatchID: q, ToWorkerID: b}}, adminID, ip)
	if err != nil || len(res) != 1 || res[0].Moved != 2 || res[0].BatchCode != qCode {
		t.Fatalf("quota hand-over: %+v %v", res, err)
	}
	if tg := targets(q); !is(tg[a], 1) || !is(tg[b], 4) || len(tg) != 2 {
		t.Fatalf("quota targets after: A=%v B=%v (%d)", tg[a], tg[b], len(tg))
	}
	var hoMoved int
	if err := pool.QueryRow(ctx, `SELECT (data->'hand_over'->>'moved')::int FROM batch_events
		WHERE batch_id=$1 AND kind='assigned' AND data ? 'hand_over'`, q).Scan(&hoMoved); err != nil || hoMoved != 2 {
		t.Fatalf("hand_over event: moved=%d %v", hoMoved, err)
	}
	// A's quota is now spent: a second scan is refused by the existing quota gate.
	if _, err := s.ScanUnit(ctx, d.Units[1].UnitCode, a, "stitcher", ip); !errors.Is(err, ErrQuotaReached) {
		t.Fatalf("A scan after hand-over: want ErrQuotaReached, got %v", err)
	}
	if open, _ := s.OpenStitchingFor(ctx, a); len(open) != 1 || open[0].LeftQty != 0 {
		t.Fatalf("open for A after: %+v", open)
	}

	// ── Guards ──
	_, err = s.HandOver(ctx, a, []HandOverMove{{BatchID: q, ToWorkerID: b}}, adminID, ip)
	mustInvalid("nothing left", err)
	_, err = s.HandOver(ctx, b, []HandOverMove{{BatchID: q, ToWorkerID: b}}, adminID, ip)
	mustInvalid("to self", err)
	_, err = s.HandOver(ctx, b, []HandOverMove{{BatchID: q, ToWorkerID: cutterID}}, adminID, ip)
	mustInvalid("to a cutter", err)
	_, err = s.HandOver(ctx, c, []HandOverMove{{BatchID: q, ToWorkerID: b}}, adminID, ip)
	mustInvalid("from not assigned", err)
	_, err = s.HandOver(ctx, b, nil, adminID, ip)
	mustInvalid("no moves", err)
	if _, err = s.HandOver(ctx, b, []HandOverMove{{BatchID: uuid.New(), ToWorkerID: c}}, adminID, ip); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown batch: want ErrNotFound, got %v", err)
	}

	// ── Untouched stitcher on a quota batch is removed; new stitcher added with the rest ──
	q2, _ := newBatch(2, true)
	if err := s.SetAssignments(ctx, q2, PhaseStitching, []AssignmentInput{{WorkerID: b, TargetQty: n(2)}}, adminID, ip); err != nil {
		t.Fatal(err)
	}

	// ── All or nothing: B's two batches, the second move is to a batch still in cutting ──
	cutting, _ := newBatch(2, false)
	_, err = s.HandOver(ctx, b, []HandOverMove{{BatchID: q2, ToWorkerID: c}, {BatchID: cutting, ToWorkerID: c}}, adminID, ip)
	mustInvalid("batch not in stitching", err)
	if tg := targets(q2); !is(tg[b], 2) || len(tg) != 1 {
		t.Fatalf("rollback: q2 changed: %v", tg)
	}

	res, err = s.HandOver(ctx, b, []HandOverMove{{BatchID: q, ToWorkerID: c}, {BatchID: q2, ToWorkerID: c}}, adminID, ip)
	if err != nil || len(res) != 2 || res[0].Moved != 4 || res[1].Moved != 2 {
		t.Fatalf("multi hand-over: %+v %v", res, err)
	}
	if tg := targets(q); !is(tg[a], 1) || !is(tg[c], 4) || len(tg) != 2 {
		t.Fatalf("q after B → C: %v", tg)
	}
	if tg := targets(q2); !is(tg[c], 2) || len(tg) != 1 {
		t.Fatalf("q2 after B → C: %v", tg)
	}

	// ── Shared pile: A + B, A → C adds C and drops A (nothing stitched) ──
	sp, _ := newBatch(2, true)
	if err := s.SetAssignments(ctx, sp, PhaseStitching, []AssignmentInput{{WorkerID: a}, {WorkerID: b}}, adminID, ip); err != nil {
		t.Fatal(err)
	}
	res, err = s.HandOver(ctx, a, []HandOverMove{{BatchID: sp, ToWorkerID: c}}, adminID, ip)
	if err != nil || res[0].Moved != 0 {
		t.Fatalf("shared hand-over: %+v %v", res, err)
	}
	tg := targets(sp)
	if _, hasA := tg[a]; hasA || tg[b] != nil || tg[c] != nil || len(tg) != 2 {
		t.Fatalf("shared after: %v", tg)
	}
	if _, hasB := tg[b]; !hasB {
		t.Fatalf("shared after: B dropped: %v", tg)
	}
}
