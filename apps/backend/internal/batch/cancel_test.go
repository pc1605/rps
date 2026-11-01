package batch

import (
	"errors"
	"testing"
)

// TestCancel pins POST /batches/:id/cancel (D35): cut and stitched mats → spare (codes kept), never-cut
// units removed, open rework written off, logs closed, assignments cleared; refused once packed.
func TestCancel(t *testing.T) {
	f := newU3(t, "cancel")
	a := f.stitcher("A")

	t.Run("short cut sent back to cutting: cut → spare, rest removed", func(t *testing.T) {
		b := f.create(CreateInput{Quantity: 6})
		f.cut(b.ID, 4)
		if _, err := f.s.ResolveShort(f.ctx, b.ID, ShortRecut, "roll_ran_out", "", f.admin, u3ip); err != nil {
			t.Fatal(err)
		}
		f.join(b.ID, f.cutter, "cutter") // claimed again; cancel still allowed, the open log closes
		pre, err := f.s.CancelPreview(f.ctx, b.ID)
		if err != nil {
			t.Fatal(err)
		}
		if pre.SpareUnstitched != 4 || pre.Removed != 2 || pre.Blocked != "" {
			t.Fatalf("preview = %+v", pre)
		}
		o, err := f.s.Cancel(f.ctx, b.ID, "order_cancelled", "", f.admin, "owner", u3ip)
		if err != nil {
			t.Fatal(err)
		}
		if *o != *pre {
			t.Fatalf("outcome %+v != preview %+v", o, pre)
		}
		if _, st := f.state(b.ID); st != StatusCancelled {
			t.Fatalf("status = %s", st)
		}
		if n := f.count(`SELECT COUNT(*) FROM batch_units WHERE batch_id=$1 AND status='spare'`, b.ID); n != 4 {
			t.Fatalf("spares = %d, want 4", n)
		}
		if n := f.count(`SELECT COUNT(*) FROM batch_units WHERE batch_id=$1`, b.ID); n != 4 {
			t.Fatalf("units = %d, want 4", n)
		}
		if n := f.count(`SELECT COUNT(*) FROM phase_logs WHERE batch_id=$1 AND completed_at IS NULL`, b.ID); n != 0 {
			t.Fatalf("open logs = %d", n)
		}
		if n := f.count(`SELECT COUNT(*) FROM batch_events WHERE batch_id=$1 AND kind='cancelled' AND (data->>'spare_unstitched')::int = 4`, b.ID); n != 1 {
			t.Fatalf("cancelled events = %d", n)
		}
		if _, err := f.s.Cancel(f.ctx, b.ID, "order_cancelled", "", f.admin, "owner", u3ip); !errors.Is(err, ErrNotCancellable) {
			t.Fatalf("second cancel: %v", err)
		}
	})

	t.Run("mid-stitching: stitched and unstitched → spare, assignments cleared", func(t *testing.T) {
		b := f.create(CreateInput{Quantity: 5})
		f.cut(b.ID, 5)
		f.assign(b.ID, AssignmentInput{WorkerID: a})
		f.join(b.ID, a, "stitcher")
		codes := f.codes(b.ID)
		f.scan(codes[0], a, "stitcher")
		f.scan(codes[1], a, "stitcher")
		o, err := f.s.Cancel(f.ctx, b.ID, "other", "customer went elsewhere", f.admin, "owner", u3ip)
		if err != nil {
			t.Fatal(err)
		}
		if o.SpareStitched != 2 || o.SpareUnstitched != 3 || o.Removed != 0 {
			t.Fatalf("outcome = %+v", o)
		}
		if n := f.count(`SELECT COUNT(*) FROM batch_assignments WHERE batch_id=$1`, b.ID); n != 0 {
			t.Fatalf("assignments left = %d", n)
		}
		if n := f.count(`SELECT quantity_completed FROM phase_logs WHERE batch_id=$1 AND phase='stitching' AND worker_id=$2`, b.ID, a); n != 2 {
			t.Fatalf("stitching log closed with %d, want 2", n)
		}
		if n := f.count(`SELECT COUNT(*) FROM batch_units WHERE unit_code=$1 AND status='spare' AND stitched_by=$2`, codes[0], a); n != 1 {
			t.Fatal("stitched spare lost its code or credit")
		}
		// a spare can't be scanned
		if _, err := f.s.ScanUnit(f.ctx, codes[3], a, "stitcher", u3ip); !errors.Is(err, ErrUnitSpare) {
			t.Fatalf("scan spare: %v", err)
		}
	})

	t.Run("packing with open rework: rework written off; packed blocks", func(t *testing.T) {
		b := f.create(CreateInput{Quantity: 3})
		f.cut(b.ID, 3)
		f.assign(b.ID, AssignmentInput{WorkerID: a})
		f.join(b.ID, a, "stitcher")
		codes := f.codes(b.ID)
		for _, c := range codes {
			f.scan(c, a, "stitcher")
		}
		f.join(b.ID, f.packer, "packer")
		if _, err := f.s.FlagRework(f.ctx, codes[0], f.packer, "packer", []string{"stain"}, nil, []string{"x.jpg"}, u3ip); err != nil {
			t.Fatal(err)
		}
		o, err := f.s.CancelPreview(f.ctx, b.ID)
		if err != nil {
			t.Fatal(err)
		}
		if o.WrittenOff != 1 || o.SpareStitched != 2 || o.Blocked != "" {
			t.Fatalf("preview = %+v", o)
		}
		f.scan(codes[1], f.packer, "packer")
		if o, _ := f.s.CancelPreview(f.ctx, b.ID); o.Blocked == "" {
			t.Fatal("preview not blocked after a pack")
		}
		if _, err := f.s.Cancel(f.ctx, b.ID, "order_cancelled", "", f.admin, "owner", u3ip); !errors.Is(err, ErrNotCancellable) {
			t.Fatalf("cancel after pack: %v", err)
		}
	})

	t.Run("rework written off on cancel", func(t *testing.T) {
		b := f.create(CreateInput{Quantity: 2})
		f.cut(b.ID, 2)
		f.assign(b.ID, AssignmentInput{WorkerID: a})
		f.join(b.ID, a, "stitcher")
		codes := f.codes(b.ID)
		for _, c := range codes {
			f.scan(c, a, "stitcher")
		}
		f.join(b.ID, f.packer, "packer")
		if _, err := f.s.FlagRework(f.ctx, codes[0], f.packer, "packer", []string{"stain"}, nil, []string{"x.jpg"}, u3ip); err != nil {
			t.Fatal(err)
		}
		if _, err := f.s.Cancel(f.ctx, b.ID, "order_changed", "", f.admin, "owner", u3ip); err != nil {
			t.Fatal(err)
		}
		if n := f.count(`SELECT COUNT(*) FROM batch_units WHERE unit_code=$1 AND status='defective'`, codes[0]); n != 1 {
			t.Fatal("rework mat not written off")
		}
		if n := f.count(`SELECT COUNT(*) FROM rework_logs WHERE batch_id=$1 AND decision='write_off'`, b.ID); n != 1 {
			t.Fatal("rework round not closed as write_off")
		}
		if n := f.count(`SELECT COUNT(*) FROM phase_logs WHERE batch_id=$1 AND phase='packing' AND completed_at IS NOT NULL`, b.ID); n != 1 {
			t.Fatal("packing log not closed")
		}
	})

	if _, err := f.s.Cancel(f.ctx, f.create(CreateInput{Quantity: 1}).ID, "nope", "", f.admin, "owner", u3ip); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad reason: %v", err)
	}
}
