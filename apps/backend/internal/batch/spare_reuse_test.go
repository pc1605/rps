package batch

import (
	"errors"
	"strings"
	"testing"
)

// TestSpareReuse pins reusing spares on New batch (D36): spares join already cut (units 1..k),
// unstitched ones get the new code, stitched ones keep theirs and their stitcher's credit, quotas
// cover only the mats still to stitch, and spares covering the whole batch skip cutting (all
// stitched → packing).
func TestSpareReuse(t *testing.T) {
	f := newU3(t, "reuse")
	a, b2, c := f.stitcher("A"), f.stitcher("B"), f.stitcher("C")

	// A cancelled batch of 6: 2 stitched by A, 4 cut but not stitched.
	makeSpares := func(qty, stitched int) {
		t.Helper()
		src := f.create(CreateInput{Quantity: qty})
		f.cut(src.ID, qty)
		f.assign(src.ID, AssignmentInput{WorkerID: a})
		f.join(src.ID, a, "stitcher")
		for _, code := range f.codes(src.ID)[:stitched] {
			f.scan(code, a, "stitcher")
		}
		if _, err := f.s.Cancel(f.ctx, src.ID, "order_cancelled", "", f.admin, "owner", u3ip); err != nil {
			t.Fatal(err)
		}
	}
	makeSpares(6, 2)

	if _, err := f.s.Create(f.ctx, CreateInput{CarModelID: f.car, Quantity: 2, SparesUnstitched: 3}, f.admin, "owner", u3ip); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("more spares than quantity: %v", err)
	}
	if _, err := f.s.Create(f.ctx, CreateInput{CarModelID: f.car, Quantity: 9, SparesStitched: 3}, f.admin, "owner", u3ip); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("more stitched spares than exist: %v", err)
	}
	other := testCar(t, f.pool, "reuse-other")
	if _, err := f.s.Create(f.ctx, CreateInput{CarModelID: other, Quantity: 2, SparesUnstitched: 1}, f.admin, "owner", u3ip); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("spares of another car item: %v", err)
	}

	// Partial: 10 mats, reuse 2 stitched + 3 unstitched → cutter cuts 5.
	nb := f.create(CreateInput{Quantity: 10, SparesStitched: 2, SparesUnstitched: 3})
	if p, st := f.state(nb.ID); p != PhaseCutting || st != StatusPending {
		t.Fatalf("partial reuse state = %s/%s", p, st)
	}
	d, err := f.s.Get(f.ctx, nb.ID)
	if err != nil {
		t.Fatal(err)
	}
	if d.CutQty != 5 || d.UnitsTotal != 10 || d.UnitsStitched != 2 || d.UnitsPrestitched != 2 {
		t.Fatalf("detail: cut %d total %d stitched %d pre %d", d.CutQty, d.UnitsTotal, d.UnitsStitched, d.UnitsPrestitched)
	}
	for i, u := range d.Units {
		switch {
		case i < 2:
			if !u.Prestitched || u.StitchedBy == nil || *u.StitchedBy != a || strings.HasPrefix(u.UnitCode, nb.BatchCode) || u.ReusedFrom == nil {
				t.Fatalf("unit %d should be a stitched spare keeping its code/credit: %+v", i+1, u)
			}
		case i < 5:
			if u.Prestitched || !strings.HasPrefix(u.UnitCode, nb.BatchCode+"-") || u.ReusedFrom == nil || u.Status != UnitPending {
				t.Fatalf("unit %d should be an unstitched spare with a new code: %+v", i+1, u)
			}
		default:
			if u.ReusedFrom != nil {
				t.Fatalf("unit %d should be fresh: %+v", i+1, u)
			}
		}
	}
	if left, _ := f.s.ListSpares(f.ctx, &f.car); len(left) != 1 || left[0].Stitched != 0 || left[0].Unstitched != 1 {
		t.Fatalf("spares left = %+v", left)
	}

	// The cutter cuts the 5 remaining; quotas must total 8 (10 − 2 came in stitched).
	if err := f.s.StartPhase(f.ctx, nb.ID, f.cutter, "cutter", u3ip); err != nil {
		t.Fatal(err)
	}
	if err := f.s.CompletePhase(f.ctx, nb.ID, f.cutter, "cutter", 6, "", u3ip); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("cutting more than remain: %v", err)
	}
	if err := f.s.CompletePhase(f.ctx, nb.ID, f.cutter, "cutter", 5, "", u3ip); err != nil {
		t.Fatal(err)
	}
	q := func(n int) *int { return &n }
	if err := f.s.SetAssignments(f.ctx, nb.ID, PhaseStitching, []AssignmentInput{{WorkerID: b2, TargetQty: q(5)}, {WorkerID: c, TargetQty: q(5)}}, f.admin, u3ip); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("quotas totalling quantity should be refused: %v", err)
	}
	// A (who stitched the 2 spares) is not assigned — the "can't remove a worker with done mats" guard must not fire.
	f.assign(nb.ID, AssignmentInput{WorkerID: b2, TargetQty: q(4)}, AssignmentInput{WorkerID: c, TargetQty: q(4)})
	f.join(nb.ID, b2, "stitcher")
	f.join(nb.ID, c, "stitcher")
	codes := f.codes(nb.ID)
	// already-stitched spare: idempotent
	if r := f.scan(codes[0], b2, "stitcher"); !r.AlreadyDone {
		t.Fatalf("scan prestitched: %+v", r)
	}
	var last *ScanResult
	for i, code := range codes[2:] {
		w := b2
		if i >= 4 {
			w = c
		}
		last = f.scan(code, w, "stitcher")
	}
	if !last.PhaseCompleted {
		t.Fatalf("stitching should complete after the 8 left: %+v", last)
	}
	if n := f.count(`SELECT quantity_completed FROM phase_logs WHERE batch_id=$1 AND phase='stitching' AND worker_id=$2`, nb.ID, b2); n != 4 {
		t.Fatalf("B's log = %d, want 4", n)
	}
	if n := f.count(`SELECT COUNT(*) FROM batch_units WHERE batch_id=$1 AND stitched_by=$2`, nb.ID, a); n != 2 {
		t.Fatalf("A keeps credit for %d, want 2", n)
	}

	// Whole batch from unstitched spares → skips cutting.
	makeSpares(3, 0)
	full := f.create(CreateInput{Quantity: 4, SparesUnstitched: 4}) // 1 left from before + 3
	if p, st := f.state(full.ID); p != PhaseStitching || st != StatusAwaitingAssignment {
		t.Fatalf("all-spare batch state = %s/%s", p, st)
	}

	// Whole batch from stitched spares → straight to packing.
	makeSpares(2, 2)
	packed := f.create(CreateInput{Quantity: 2, SparesStitched: 2})
	if p, st := f.state(packed.ID); p != PhasePacking || st != StatusPending {
		t.Fatalf("all-stitched batch state = %s/%s", p, st)
	}
	f.join(packed.ID, f.packer, "packer")
	var done *ScanResult
	for _, code := range f.codes(packed.ID) {
		done = f.scan(code, f.packer, "packer")
	}
	if !done.BatchCompleted {
		t.Fatal("packing the stitched spares should complete the batch")
	}
}
