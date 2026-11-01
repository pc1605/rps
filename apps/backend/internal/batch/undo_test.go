package batch

import (
	"errors"
	"testing"
)

// TestUndoScan pins POST /units/:code/undo-scan (D38).
func TestUndoScan(t *testing.T) {
	f := newU3(t, "undo")
	a := f.stitcher("A")

	b := f.create(CreateInput{Quantity: 2})
	f.cut(b.ID, 2)
	f.assign(b.ID, AssignmentInput{WorkerID: a})
	f.join(b.ID, a, "stitcher")
	codes := f.codes(b.ID)

	if _, err := f.s.UndoScan(f.ctx, codes[0], "", f.admin, "owner", u3ip); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("no reason: %v", err)
	}
	if _, err := f.s.UndoScan(f.ctx, codes[0], "oops", f.admin, "owner", u3ip); !errors.Is(err, ErrCantUndo) {
		t.Fatalf("nothing scanned: %v", err)
	}

	// stitch → undo inside stitching
	f.scan(codes[0], a, "stitcher")
	r, err := f.s.UndoScan(f.ctx, codes[0], "scanned the wrong mat", f.admin, "owner", u3ip)
	if err != nil || r.Scan != "stitch" || r.MovedBack {
		t.Fatalf("undo stitch: %+v %v", r, err)
	}
	if n := f.count(`SELECT COUNT(*) FROM batch_units WHERE batch_id=$1 AND stitched_at IS NOT NULL`, b.ID); n != 0 {
		t.Fatalf("stitched = %d", n)
	}

	// last stitch moved the batch to packing → undo moves it back and reopens A's log
	f.scan(codes[0], a, "stitcher")
	if res := f.scan(codes[1], a, "stitcher"); !res.PhaseCompleted {
		t.Fatal("stitching should complete")
	}
	r, err = f.s.UndoScan(f.ctx, codes[1], "double scan", f.admin, "owner", u3ip)
	if err != nil || !r.MovedBack || r.Phase != PhaseStitching {
		t.Fatalf("undo last stitch: %+v %v", r, err)
	}
	if p, st := f.state(b.ID); p != PhaseStitching || st != StatusInProgress {
		t.Fatalf("state = %s/%s", p, st)
	}
	if n := f.count(`SELECT COUNT(*) FROM phase_logs WHERE batch_id=$1 AND phase='stitching' AND completed_at IS NULL AND worker_id=$2`, b.ID, a); n != 1 {
		t.Fatal("A's stitching log not reopened")
	}
	// A carries on scanning; stitching completes again
	if res := f.scan(codes[1], a, "stitcher"); !res.PhaseCompleted {
		t.Fatal("stitching should complete again")
	}

	// packing started → stitch undo refused
	f.join(b.ID, f.packer, "packer")
	if _, err := f.s.UndoScan(f.ctx, codes[0], "late", f.admin, "owner", u3ip); !errors.Is(err, ErrCantUndo) {
		t.Fatalf("stitch undo after packing began: %v", err)
	}

	// pack → completion → undo pack returns to packing; packer's log reopened
	f.scan(codes[0], f.packer, "packer")
	if res := f.scan(codes[1], f.packer, "packer"); !res.BatchCompleted {
		t.Fatal("batch should complete")
	}
	r, err = f.s.UndoScan(f.ctx, codes[1], "packed the wrong one", f.admin, "owner", u3ip)
	if err != nil || r.Scan != "pack" || !r.MovedBack || r.Phase != PhasePacking {
		t.Fatalf("undo pack: %+v %v", r, err)
	}
	if n := f.count(`SELECT COUNT(*) FROM phase_logs WHERE batch_id=$1 AND phase='packing' AND completed_at IS NULL`, b.ID); n != 1 {
		t.Fatal("packing log not reopened")
	}
	if res := f.scan(codes[1], f.packer, "packer"); !res.BatchCompleted {
		t.Fatal("batch should complete again")
	}
	if n := f.count(`SELECT COUNT(*) FROM batch_events WHERE batch_id=$1 AND kind='scan_undone'`, b.ID); n != 3 {
		t.Fatalf("scan_undone events = %d", n)
	}
}
