package batch

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

// TestScanRemovedStitcher: a stitcher who joined and was then taken off the batch — by a hand-over
// or by an assignment edit — leaves it: their open log closes and their scanner is refused.
func TestScanRemovedStitcher(t *testing.T) {
	f := newU3(t, "removed")
	a, b := f.stitcher("A"), f.stitcher("B")
	two := func() *int { n := 2; return &n }

	openLog := func(id, w uuid.UUID) int {
		return f.count(`SELECT COUNT(*) FROM phase_logs WHERE batch_id=$1 AND worker_id=$2 AND phase='stitching' AND completed_at IS NULL`, id, w)
	}

	t.Run("hand-over", func(t *testing.T) {
		bt := f.create(CreateInput{Quantity: 4})
		f.cut(bt.ID, 4)
		f.assign(bt.ID, AssignmentInput{WorkerID: a, TargetQty: two()}, AssignmentInput{WorkerID: b, TargetQty: two()})
		f.join(bt.ID, a, "stitcher")
		if _, err := f.s.HandOver(f.ctx, a, []HandOverMove{{BatchID: bt.ID, ToWorkerID: b}}, f.admin, u3ip); err != nil {
			t.Fatal(err)
		}
		if n := openLog(bt.ID, a); n != 0 {
			t.Fatalf("A's log still open after the hand-over (%d)", n)
		}
		codes := f.codes(bt.ID)
		if _, err := f.s.ScanUnit(f.ctx, codes[0], a, "stitcher", u3ip); !errors.Is(err, ErrNotAssigned) {
			t.Fatalf("A scans after the hand-over: err = %v, want ErrNotAssigned", err)
		}
		if n := f.count(`SELECT COUNT(*) FROM batch_units WHERE batch_id=$1 AND stitched_at IS NOT NULL`, bt.ID); n != 0 {
			t.Fatalf("%d mats stitched, want 0", n)
		}
		// B (now 4 of 4) can still do the whole batch.
		f.join(bt.ID, b, "stitcher")
		for _, c := range codes {
			f.scan(c, b, "stitcher")
		}
		if p, _ := f.state(bt.ID); p != PhasePacking {
			t.Fatalf("phase = %s, want packing", p)
		}
	})

	t.Run("assignment edit", func(t *testing.T) {
		bt := f.create(CreateInput{Quantity: 2})
		f.cut(bt.ID, 2)
		f.assign(bt.ID, AssignmentInput{WorkerID: a}, AssignmentInput{WorkerID: b})
		f.join(bt.ID, a, "stitcher")
		f.join(bt.ID, b, "stitcher")
		f.assign(bt.ID, AssignmentInput{WorkerID: b}) // A is taken off
		if n := openLog(bt.ID, a); n != 0 {
			t.Fatalf("A's log still open after the edit (%d)", n)
		}
		if n := openLog(bt.ID, b); n != 1 {
			t.Fatalf("B's log should stay open, got %d", n)
		}
		if _, err := f.s.ScanUnit(f.ctx, f.codes(bt.ID)[0], a, "stitcher", u3ip); !errors.Is(err, ErrNotAssigned) {
			t.Fatalf("A scans after the edit: err = %v, want ErrNotAssigned", err)
		}
		// Put back on the batch, A joins again and scans normally.
		f.assign(bt.ID, AssignmentInput{WorkerID: a}, AssignmentInput{WorkerID: b})
		f.join(bt.ID, a, "stitcher")
		f.scan(f.codes(bt.ID)[0], a, "stitcher")
	})
}

// TestScanSameMatAtOnce: two scans of one mat that arrive together (one waits for the other's lock)
// record it once — the second sees it already stitched — and the credit stays with the first.
func TestScanSameMatAtOnce(t *testing.T) {
	f := newU3(t, "samemat")
	a, b := f.stitcher("A"), f.stitcher("B")
	bt := f.create(CreateInput{Quantity: 2})
	f.cut(bt.ID, 2)
	f.assign(bt.ID, AssignmentInput{WorkerID: a}, AssignmentInput{WorkerID: b})
	f.join(bt.ID, a, "stitcher")
	f.join(bt.ID, b, "stitcher")
	code := f.codes(bt.ID)[0]

	// Hold the batch lock so both scans queue up behind it, A first.
	hold, err := f.pool.Begin(f.ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := hold.Exec(f.ctx, `SELECT id FROM batches WHERE id=$1 FOR UPDATE`, bt.ID); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	results := make([]*ScanResult, 2)
	errs := make([]error, 2)
	for i, w := range []uuid.UUID{a, b} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results[i], errs[i] = f.s.ScanUnit(f.ctx, code, w, "stitcher", u3ip)
		}()
		time.Sleep(200 * time.Millisecond) // A is waiting on the lock before B arrives
	}
	if err := hold.Commit(f.ctx); err != nil {
		t.Fatal(err)
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("scan %d: %v", i, err)
		}
	}
	if results[0].AlreadyDone || !results[1].AlreadyDone {
		t.Fatalf("already_done = %v, %v; want false, true", results[0].AlreadyDone, results[1].AlreadyDone)
	}
	var by uuid.UUID
	if err := f.pool.QueryRow(f.ctx, `SELECT stitched_by FROM batch_units WHERE unit_code=$1`, code).Scan(&by); err != nil {
		t.Fatal(err)
	}
	if by != a {
		t.Fatal("the mat's credit moved to the second scan")
	}
}
