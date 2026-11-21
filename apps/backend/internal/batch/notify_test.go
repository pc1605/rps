package batch

import (
	"slices"
	"sync"
	"testing"

	"github.com/google/uuid"
)

// recNotifier records what the service asked to notify.
type recNotifier struct {
	mu       sync.Mutex
	assigned []string // "batch:worker"
	rework   []string // "rework:stitcher"
}

func (r *recNotifier) BatchAssigned(batchID uuid.UUID, workerIDs []uuid.UUID) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, w := range workerIDs {
		r.assigned = append(r.assigned, batchID.String()+":"+w.String())
	}
}

func (r *recNotifier) ReworkSent(reworkID, stitcherID uuid.UUID) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rework = append(r.rework, reworkID.String()+":"+stitcherID.String())
}

// take returns what was recorded since the last call.
func (r *recNotifier) take() (assigned, rework []string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	assigned, rework = r.assigned, r.rework
	r.assigned, r.rework = nil, nil
	return assigned, rework
}

// N1: who gets told, and when — newly assigned workers on a batch at their station, the stitcher a batch
// is handed over to, the stitcher a rework mat is sent to. Nobody else, and nothing for unchanged assignments.
func TestNotifications(t *testing.T) {
	f := newU3(t, "T notify")
	rec := &recNotifier{}
	f.s.SetNotifier(rec)
	a, b, c := f.stitcher("A"), f.stitcher("B"), f.stitcher("C")
	pair := func(x, y uuid.UUID) string { return x.String() + ":" + y.String() }
	expect := func(what string, wantAssigned, wantRework []string) {
		t.Helper()
		gotA, gotR := rec.take()
		slices.Sort(gotA)
		slices.Sort(wantAssigned)
		if !slices.Equal(gotA, wantAssigned) || !slices.Equal(gotR, wantRework) {
			t.Fatalf("%s: assigned %v rework %v — want %v / %v", what, gotA, gotR, wantAssigned, wantRework)
		}
	}

	bt := f.create(CreateInput{Quantity: 2})
	f.cut(bt.ID, 2)
	expect("cutting", nil, nil)

	f.assign(bt.ID, AssignmentInput{WorkerID: a})
	expect("first assignment", []string{pair(bt.ID, a)}, nil)

	f.assign(bt.ID, AssignmentInput{WorkerID: a}, AssignmentInput{WorkerID: b})
	expect("helper added", []string{pair(bt.ID, b)}, nil)

	f.assign(bt.ID, AssignmentInput{WorkerID: a}, AssignmentInput{WorkerID: b})
	expect("same assignment saved again", nil, nil)

	if _, err := f.s.HandOver(f.ctx, b, []HandOverMove{{BatchID: bt.ID, ToWorkerID: c}}, f.admin, u3ip); err != nil {
		t.Fatal(err)
	}
	expect("hand-over", []string{pair(bt.ID, c)}, nil)

	// Handing over to someone already on the batch is more of the same work, not a new batch: no notification.
	if _, err := f.s.HandOver(f.ctx, c, []HandOverMove{{BatchID: bt.ID, ToWorkerID: a}}, f.admin, u3ip); err != nil {
		t.Fatal(err)
	}
	expect("hand-over to a stitcher already on the batch", nil, nil)

	// A stitches both mats; the batch goes to packing.
	f.join(bt.ID, a, "stitcher")
	codes := f.codes(bt.ID)
	for _, code := range codes {
		f.scan(code, a, "stitcher")
	}
	f.join(bt.ID, f.packer, "packer")
	expect("stitching and packing", nil, nil)

	// Round 1, stitching fault → straight back to the stitcher who sewed it.
	rw, err := f.s.FlagRework(f.ctx, codes[0], f.packer, "packer", []string{"stain"}, nil, []string{"x.jpg"}, u3ip)
	if err != nil {
		t.Fatal(err)
	}
	expect("rework to the stitcher", nil, []string{pair(rw.ID, a)})

	// Cutting fault → the owner decides; nobody is told until they send it to the stitcher.
	rw2, err := f.s.FlagRework(f.ctx, codes[1], f.packer, "packer", []string{"cutting_fault"}, nil, []string{"x.jpg"}, u3ip)
	if err != nil {
		t.Fatal(err)
	}
	expect("rework to the owner", nil, nil)
	if _, err := f.s.DecideRework(f.ctx, rw2.ID, "to_stitcher", nil, f.admin, u3ip); err != nil {
		t.Fatal(err)
	}
	expect("owner sends it to the stitcher", nil, []string{pair(rw2.ID, a)})

	// Packing is an open queue: assigning a packer to a batch at packing tells them; at another station it doesn't.
	if err := f.s.SetAssignments(f.ctx, bt.ID, PhasePacking, []AssignmentInput{{WorkerID: f.packer}}, f.admin, u3ip); err != nil {
		t.Fatal(err)
	}
	expect("packer assigned at packing", []string{pair(bt.ID, f.packer)}, nil)
	other := f.create(CreateInput{Quantity: 1})
	if err := f.s.SetAssignments(f.ctx, other.ID, PhasePacking, []AssignmentInput{{WorkerID: f.packer}}, f.admin, u3ip); err != nil {
		t.Fatal(err)
	}
	expect("packer assigned while the batch is still cutting", nil, nil)
}
