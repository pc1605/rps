package batch

import (
	"errors"
	"testing"
)

// TestReleaseClaim pins releasing a cutting claim (D37): the open log is deleted, the batch goes
// back to the admin (cutting/awaiting_assignment, cutter cleared — D48) with a claim_released event;
// only the holder (or the admin) may release; a cutter gives a reason, which the batch page shows.
func TestReleaseClaim(t *testing.T) {
	f := newU3(t, "release")
	b := f.create(CreateInput{Quantity: 3})

	if err := f.s.ReleaseClaim(f.ctx, b.ID, &f.admin, nil, "", "", "owner", u3ip); !errors.Is(err, ErrNoClaim) {
		t.Fatalf("no claim: %v", err)
	}
	f.join(b.ID, f.cutter, "cutter")
	other := f.stitcher("X") // any other worker id
	if err := f.s.ReleaseClaim(f.ctx, b.ID, nil, &other, "machine_issue", "", "cutter", u3ip); !errors.Is(err, ErrNotYours) {
		t.Fatalf("someone else's claim: %v", err)
	}
	// A cutter says why (D48): a known reason, and words when it is Other.
	for _, bad := range [][2]string{{"", ""}, {"no_such_reason", ""}, {"other", ""}} {
		if err := f.s.ReleaseClaim(f.ctx, b.ID, nil, &f.cutter, bad[0], bad[1], "cutter", u3ip); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("reason %q note %q: %v", bad[0], bad[1], err)
		}
	}
	if err := f.s.ReleaseClaim(f.ctx, b.ID, nil, &f.cutter, "other", "blade broke", "cutter", u3ip); err != nil {
		t.Fatal(err)
	}
	d, err := f.s.Get(f.ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if g := d.GivenBack; g == nil || g.WorkerID != f.cutter || g.By != "cutter" || g.Reason != "other" || g.Note != "blade broke" {
		t.Fatalf("given_back after cutter: %+v", g)
	}
	if p, st := f.state(b.ID); p != PhaseCutting || st != StatusAwaitingAssignment {
		t.Fatalf("after cutter release: %s/%s", p, st)
	}
	if n := f.count(`SELECT COUNT(*) FROM phase_logs WHERE batch_id=$1`, b.ID); n != 0 {
		t.Fatalf("logs left = %d", n)
	}

	// claim again, admin releases, then it can be claimed and cut normally
	f.join(b.ID, f.cutter, "cutter")
	if err := f.s.ReleaseClaim(f.ctx, b.ID, &f.admin, nil, "", "", "owner", u3ip); err != nil {
		t.Fatal(err)
	}
	if n := f.count(`SELECT COUNT(*) FROM batch_events WHERE batch_id=$1 AND kind='claim_released'`, b.ID); n != 2 {
		t.Fatalf("claim_released events = %d", n)
	}
	if d, err = f.s.Get(f.ctx, b.ID); err != nil {
		t.Fatal(err)
	}
	if g := d.GivenBack; g == nil || g.By != "admin" || g.Reason != "" || g.Note != "" {
		t.Fatalf("given_back after admin: %+v", g)
	}
	f.cut(b.ID, 3)
	if err := f.s.ReleaseClaim(f.ctx, b.ID, &f.admin, nil, "", "", "owner", u3ip); !errors.Is(err, ErrWrongPhase) {
		t.Fatalf("after cutting: %v", err)
	}
}
