package batch

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// TestEditBeforeCutting pins PATCH /batches/:id: quantity change adds/removes units, the
// "edited" event carries before/after, and edits are refused once the cutter has claimed it.
func TestEditBeforeCutting(t *testing.T) {
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
	car, car2 := testCar(t, pool, "edit"), testCar(t, pool, "edit2")
	bt, err := s.Create(ctx, CreateInput{CarModelID: car, Quantity: 4}, adminID, "owner", ip)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM batches WHERE id = $1`, bt.ID) })

	units := func() (n, maxNum int) {
		t.Helper()
		if err := pool.QueryRow(ctx, `SELECT COUNT(*), COALESCE(MAX(unit_number),0) FROM batch_units WHERE batch_id=$1`, bt.ID).Scan(&n, &maxNum); err != nil {
			t.Fatal(err)
		}
		return
	}
	ptr := func(v int) *int { return &v }
	str := func(v string) *string { return &v }

	// grow + change car + notes
	if err := s.Edit(ctx, bt.ID, EditInput{CarModelID: ptr(car2), Quantity: ptr(6), Notes: str(" rush ")}, adminID, "owner", ip); err != nil {
		t.Fatal(err)
	}
	if n, m := units(); n != 6 || m != 6 {
		t.Fatalf("after grow: %d units, max %d; want 6/6", n, m)
	}
	var gotCar, gotQty int
	var notes string
	if err := pool.QueryRow(ctx, `SELECT car_model_id, quantity, COALESCE(notes,'') FROM batches WHERE id=$1`, bt.ID).Scan(&gotCar, &gotQty, &notes); err != nil {
		t.Fatal(err)
	}
	if gotCar != car2 || gotQty != 6 || notes != "rush" {
		t.Fatalf("batch = car %d qty %d notes %q", gotCar, gotQty, notes)
	}

	// shrink
	if err := s.Edit(ctx, bt.ID, EditInput{Quantity: ptr(3)}, adminID, "owner", ip); err != nil {
		t.Fatal(err)
	}
	if n, m := units(); n != 3 || m != 3 {
		t.Fatalf("after shrink: %d units, max %d; want 3/3", n, m)
	}

	// no-op writes nothing
	if err := s.Edit(ctx, bt.ID, EditInput{Quantity: ptr(3)}, adminID, "owner", ip); err != nil {
		t.Fatal(err)
	}
	var edits int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM batch_events WHERE batch_id=$1 AND kind='edited'`, bt.ID).Scan(&edits); err != nil {
		t.Fatal(err)
	}
	if edits != 2 {
		t.Fatalf("edited events = %d, want 2", edits)
	}
	var beforeQty, afterQty int
	if err := pool.QueryRow(ctx, `SELECT (data->'before'->>'quantity')::int, (data->'after'->>'quantity')::int
		FROM batch_events WHERE batch_id=$1 AND kind='edited' ORDER BY id DESC LIMIT 1`, bt.ID).Scan(&beforeQty, &afterQty); err != nil {
		t.Fatal(err)
	}
	if beforeQty != 6 || afterQty != 3 {
		t.Fatalf("event before/after = %d/%d, want 6/3", beforeQty, afterQty)
	}

	if err := s.Edit(ctx, bt.ID, EditInput{Quantity: ptr(0)}, adminID, "owner", ip); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("qty 0: err = %v, want invalid input", err)
	}

	// claimed by the cutter → refused
	if err := s.StartPhase(ctx, bt.ID, cutterID, "cutter", ip); err != nil {
		t.Fatal(err)
	}
	if err := s.Edit(ctx, bt.ID, EditInput{Quantity: ptr(5)}, adminID, "owner", ip); !errors.Is(err, ErrNotEditable) {
		t.Fatalf("claimed: err = %v, want ErrNotEditable", err)
	}
}
