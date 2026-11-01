package batch

import (
	"errors"
	"testing"
)

// TestReleaseClaim pins releasing a cutting claim (D37): the open log is deleted, the batch goes
// back to cutting/pending with a claim_released event; only the holder (or the admin) may release.
func TestReleaseClaim(t *testing.T) {
	f := newU3(t, "release")
	b := f.create(CreateInput{Quantity: 3})

	if err := f.s.ReleaseClaim(f.ctx, b.ID, &f.admin, nil, "owner", u3ip); !errors.Is(err, ErrNoClaim) {
		t.Fatalf("no claim: %v", err)
	}
	f.join(b.ID, f.cutter, "cutter")
	other := f.stitcher("X") // any other worker id
	if err := f.s.ReleaseClaim(f.ctx, b.ID, nil, &other, "cutter", u3ip); !errors.Is(err, ErrNotYours) {
		t.Fatalf("someone else's claim: %v", err)
	}
	if err := f.s.ReleaseClaim(f.ctx, b.ID, nil, &f.cutter, "cutter", u3ip); err != nil {
		t.Fatal(err)
	}
	if p, st := f.state(b.ID); p != PhaseCutting || st != StatusPending {
		t.Fatalf("after cutter release: %s/%s", p, st)
	}
	if n := f.count(`SELECT COUNT(*) FROM phase_logs WHERE batch_id=$1`, b.ID); n != 0 {
		t.Fatalf("logs left = %d", n)
	}

	// claim again, admin releases, then it can be claimed and cut normally
	f.join(b.ID, f.cutter, "cutter")
	if err := f.s.ReleaseClaim(f.ctx, b.ID, &f.admin, nil, "owner", u3ip); err != nil {
		t.Fatal(err)
	}
	if n := f.count(`SELECT COUNT(*) FROM batch_events WHERE batch_id=$1 AND kind='claim_released'`, b.ID); n != 2 {
		t.Fatalf("claim_released events = %d", n)
	}
	f.cut(b.ID, 3)
	if err := f.s.ReleaseClaim(f.ctx, b.ID, &f.admin, nil, "owner", u3ip); !errors.Is(err, ErrWrongPhase) {
		t.Fatalf("after cutting: %v", err)
	}
}
