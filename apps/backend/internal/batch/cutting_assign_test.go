package batch

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

// startCutting assigns the cutter (as the batch's creator) and starts cutting — every cut needs an
// assigned cutter (D48).
func startCutting(ctx context.Context, s *Service, batchID, cutterID uuid.UUID, ip string) error {
	var admin uuid.UUID
	if err := s.pool.QueryRow(ctx, `SELECT created_by FROM batches WHERE id = $1`, batchID).Scan(&admin); err != nil {
		return err
	}
	if err := s.SetAssignments(ctx, batchID, PhaseCutting, []AssignmentInput{{WorkerID: cutterID}}, admin, ip); err != nil {
		return fmt.Errorf("assign cutter: %w", err)
	}
	return s.StartPhase(ctx, batchID, cutterID, "cutter", ip)
}

// newCutter adds a fresh active cutter (removed at test end).
func (f *u3fx) newCutter(name string) uuid.UUID {
	f.t.Helper()
	var id uuid.UUID
	if err := f.pool.QueryRow(f.ctx, `
		INSERT INTO workers (name, station, pin_hash, created_by)
		VALUES ($1, 'cutter', $2, $3) RETURNING id`,
		fmt.Sprintf("%s %d", name, time.Now().UnixNano()), "$2a$10$"+strings.Repeat("x", 53), f.admin).Scan(&id); err != nil {
		f.t.Fatal(err)
	}
	f.t.Cleanup(func() { _, _ = f.pool.Exec(f.ctx, `DELETE FROM workers WHERE id = $1`, id) })
	return id
}

func (f *u3fx) setCutter(id uuid.UUID, cutters ...uuid.UUID) error {
	in := make([]AssignmentInput, 0, len(cutters))
	for _, c := range cutters {
		in = append(in, AssignmentInput{WorkerID: c})
	}
	return f.s.SetAssignments(f.ctx, id, PhaseCutting, in, f.admin, u3ip)
}

func (f *u3fx) inQueue(id, worker uuid.UUID) bool {
	f.t.Helper()
	q, err := f.s.ListByPhase(f.ctx, PhaseCutting, worker)
	if err != nil {
		f.t.Fatal(err)
	}
	for _, b := range q {
		if b.ID == id {
			return true
		}
	}
	return false
}

func (f *u3fx) inView(id uuid.UUID, view string, short *bool) *Batch {
	f.t.Helper()
	var code string
	if err := f.pool.QueryRow(f.ctx, `SELECT batch_code FROM batches WHERE id=$1`, id).Scan(&code); err != nil {
		f.t.Fatal(err)
	}
	p, err := f.s.ListPage(f.ctx, ListFilter{View: view, Q: code, Short: short})
	if err != nil {
		f.t.Fatal(err)
	}
	for i := range p.Items {
		if p.Items[i].ID == id {
			return &p.Items[i]
		}
	}
	return nil
}

// TestCutterAssignment pins D48: a batch in cutting waits for the admin to assign one cutter; only
// that cutter sees and starts it; giving it back or a re-cut returns it to the admin.
func TestCutterAssignment(t *testing.T) {
	f := newU3(t, "cutassign")
	a, b := f.newCutter("Cutter A"), f.newCutter("Cutter B")
	stitcher := f.stitcher("S")
	bt := f.create(CreateInput{Quantity: 3})

	// New batch: needs a cutter — admin only.
	if p, st := f.state(bt.ID); p != PhaseCutting || st != StatusAwaitingAssignment {
		t.Fatalf("new batch: %s/%s", p, st)
	}
	if f.inQueue(bt.ID, a) {
		t.Fatal("unassigned batch in a cutter's queue")
	}
	if err := f.s.StartPhase(f.ctx, bt.ID, a, "cutter", u3ip); !errors.Is(err, ErrNotAssigned) {
		t.Fatalf("start unassigned: %v", err)
	}
	row := f.inView(bt.ID, "to_cut", nil)
	if row == nil || row.ReadySince == nil {
		t.Fatalf("to_cut view: %+v", row)
	}
	if f.inView(bt.ID, "cutting", nil) != nil {
		t.Fatal("needs-a-cutter batch in the cutting view")
	}
	st, err := f.s.GetStats(f.ctx)
	if err != nil || st.NeedsCutter < 1 {
		t.Fatalf("stats needs_cutter: %+v %v", st, err)
	}
	// Edit still works before cutting.
	q := 4
	if err := f.s.Edit(f.ctx, bt.ID, EditInput{Quantity: &q}, f.admin, "owner", u3ip); err != nil {
		t.Fatalf("edit while needing a cutter: %v", err)
	}

	// One active cutter, no number.
	for name, in := range map[string][]AssignmentInput{
		"two cutters": {{WorkerID: a}, {WorkerID: b}},
		"quota":       {{WorkerID: a, TargetQty: &q}},
		"stitcher":    {{WorkerID: stitcher}},
	} {
		if err := f.s.SetAssignments(f.ctx, bt.ID, PhaseCutting, in, f.admin, u3ip); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("%s: %v", name, err)
		}
	}

	// Assign A: pending, in A's queue only.
	if err := f.setCutter(bt.ID, a); err != nil {
		t.Fatal(err)
	}
	if _, st := f.state(bt.ID); st != StatusPending {
		t.Fatalf("after assign: %s", st)
	}
	if !f.inQueue(bt.ID, a) || f.inQueue(bt.ID, b) {
		t.Fatal("queue: want A only")
	}
	if err := f.s.StartPhase(f.ctx, bt.ID, b, "cutter", u3ip); !errors.Is(err, ErrNotAssigned) {
		t.Fatalf("B starts A's batch: %v", err)
	}
	// Change to B, then unassign: back to needs a cutter.
	if err := f.setCutter(bt.ID, b); err != nil {
		t.Fatal(err)
	}
	if f.inQueue(bt.ID, a) || !f.inQueue(bt.ID, b) {
		t.Fatal("queue after change: want B only")
	}
	if err := f.setCutter(bt.ID); err != nil {
		t.Fatal(err)
	}
	if _, st := f.state(bt.ID); st != StatusAwaitingAssignment {
		t.Fatalf("after unassign: %s", st)
	}

	// Load: an assigned batch counts for its cutter.
	if err := f.setCutter(bt.ID, a); err != nil {
		t.Fatal(err)
	}
	loads, err := f.s.CutterLoads(f.ctx, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, l := range loads {
		if l.WorkerID == a {
			found = true
			if l.OpenBatches != 1 || l.OpenMats != 4 || l.OnFloor {
				t.Fatalf("load A: %+v", l)
			}
		}
		if l.WorkerID == stitcher {
			t.Fatal("stitcher in cutter loads")
		}
	}
	if !found {
		t.Fatal("cutter A missing from loads")
	}

	// Started: the cutter can't be changed; giving it back returns it to the admin.
	if err := f.s.StartPhase(f.ctx, bt.ID, a, "cutter", u3ip); err != nil {
		t.Fatal(err)
	}
	if err := f.setCutter(bt.ID, b); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("change while cutting: %v", err)
	}
	if err := f.s.ReleaseClaim(f.ctx, bt.ID, nil, &a, "machine_issue", "", "cutter", u3ip); err != nil {
		t.Fatal(err)
	}
	if _, st := f.state(bt.ID); st != StatusAwaitingAssignment {
		t.Fatalf("after give back: %s", st)
	}
	if n := f.count(`SELECT COUNT(*) FROM batch_assignments WHERE batch_id=$1 AND phase='cutting'`, bt.ID); n != 0 {
		t.Fatalf("cutter kept after give back: %d", n)
	}

	// Cut short, re-cut: back to needs a cutter (the first cutter's assignment cleared), not a short cut.
	f.join(bt.ID, a, "cutter")
	if err := f.s.CompletePhase(f.ctx, bt.ID, a, "cutter", 3, "", u3ip); err != nil {
		t.Fatal(err)
	}
	yes := true
	if f.inView(bt.ID, "ready", &yes) == nil {
		t.Fatal("short cut not listed as short")
	}
	if _, err := f.s.ResolveShort(f.ctx, bt.ID, ShortRecut, "roll_ran_out", "", f.admin, u3ip); err != nil {
		t.Fatal(err)
	}
	if p, st := f.state(bt.ID); p != PhaseCutting || st != StatusAwaitingAssignment {
		t.Fatalf("after re-cut: %s/%s", p, st)
	}
	if f.inQueue(bt.ID, a) {
		t.Fatal("re-cut batch still in the first cutter's queue")
	}
	if f.inView(bt.ID, "to_cut", &yes) != nil {
		t.Fatal("re-cut batch listed as a short cut")
	}
	f.cut(bt.ID, 1)

	// Split: the remainder batch needs a cutter too.
	sp := f.create(CreateInput{Quantity: 3})
	f.cut(sp.ID, 1)
	code, err := f.s.ResolveShort(f.ctx, sp.ID, ShortSplit, "roll_ran_out", "", f.admin, u3ip)
	if err != nil {
		t.Fatal(err)
	}
	var rp Phase
	var rs Status
	if err := f.pool.QueryRow(f.ctx, `SELECT current_phase, status FROM batches WHERE batch_code=$1`, code).Scan(&rp, &rs); err != nil {
		t.Fatal(err)
	}
	if rp != PhaseCutting || rs != StatusAwaitingAssignment {
		t.Fatalf("remainder: %s/%s", rp, rs)
	}
}
