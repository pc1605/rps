package batch

import (
	"errors"
	"testing"
)

// TestSpares pins GET /spares and POST /spares/write-off.
func TestSpares(t *testing.T) {
	f := newU3(t, "spares")
	a := f.stitcher("A")

	b := f.create(CreateInput{Quantity: 4})
	f.cut(b.ID, 4)
	f.assign(b.ID, AssignmentInput{WorkerID: a})
	f.join(b.ID, a, "stitcher")
	f.scan(f.codes(b.ID)[0], a, "stitcher")
	if _, err := f.s.Cancel(f.ctx, b.ID, "order_cancelled", "", f.admin, "owner", u3ip); err != nil {
		t.Fatal(err)
	}

	list, err := f.s.ListSpares(f.ctx, &f.car)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Stitched != 1 || list[0].Unstitched != 3 || len(list[0].Sources) != 1 || list[0].Sources[0].Count != 4 {
		t.Fatalf("spares = %+v", list)
	}

	if _, err := f.s.WriteOffSpares(f.ctx, SpareWriteOffInput{CarModelID: f.car, Stitched: 2}, f.admin, "owner", u3ip); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("too many: %v", err)
	}
	codes, err := f.s.WriteOffSpares(f.ctx, SpareWriteOffInput{CarModelID: f.car, Unstitched: 2, Note: "dirty"}, f.admin, "owner", u3ip)
	if err != nil || len(codes) != 2 {
		t.Fatalf("write off: %v %v", codes, err)
	}
	list, _ = f.s.ListSpares(f.ctx, &f.car)
	if len(list) != 1 || list[0].Stitched != 1 || list[0].Unstitched != 1 {
		t.Fatalf("after write-off = %+v", list)
	}
}
