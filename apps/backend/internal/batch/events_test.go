package batch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// TestBatchEvents walks one batch through every transition and pins the typed history (migration 016):
// created → cut_started → cut_completed (short) → short_resolved (split, remainder created) → assigned
// → stitching_started → stitching_completed → packing_started → completed. Also D5 (completed today).
func TestBatchEvents(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	s := NewService(pool, t.TempDir())
	const ip = "127.0.0.1"

	one := func(q string, dst any) {
		t.Helper()
		if err := pool.QueryRow(ctx, q).Scan(dst); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	var adminID, cutterID, stitcherID, packerID uuid.UUID
	one(`SELECT id FROM users LIMIT 1`, &adminID)
	one(`SELECT id FROM workers WHERE station='cutter' AND is_active LIMIT 1`, &cutterID)
	one(`SELECT id FROM workers WHERE station='stitcher' AND is_active LIMIT 1`, &stitcherID)
	one(`SELECT id FROM workers WHERE station='packer' AND is_active LIMIT 1`, &packerID)

	// Isolated car in a group with no recipe: cutting consumes no seed stock.
	var groupID, carModelID int
	sfx := time.Now().UnixNano()
	if err := pool.QueryRow(ctx, `INSERT INTO consumption_groups (name) VALUES ($1) RETURNING id`,
		fmt.Sprintf("T events %d", sfx)).Scan(&groupID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		INSERT INTO car_models (brand_id, name, size_class, pieces_per_set, product_line_id, consumption_group_id)
		SELECT (SELECT id FROM car_brands LIMIT 1), $1, 'medium', 4, (SELECT id FROM product_lines LIMIT 1), $2
		RETURNING id`, fmt.Sprintf("T events car %d", sfx), groupID).Scan(&carModelID); err != nil {
		t.Fatal(err)
	}
	var before int
	statsToday := func() int {
		t.Helper()
		st, err := s.GetStats(ctx)
		if err != nil {
			t.Fatal(err)
		}
		return st.CompletedToday
	}
	before = statsToday()

	b, err := s.Create(ctx, CreateInput{CarModelID: carModelID, Quantity: 3}, adminID, "owner", ip)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM batches WHERE parent_batch_id = $1`, b.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM batches WHERE id = $1`, b.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM car_models WHERE id = $1`, carModelID)
		_, _ = pool.Exec(ctx, `DELETE FROM consumption_groups WHERE id = $1`, groupID)
	})

	must := func(what string, err error) {
		t.Helper()
		if err != nil {
			t.Fatalf("%s: %v", what, err)
		}
	}
	must("cut start", s.StartPhase(ctx, b.ID, cutterID, "cutter", ip))
	must("cut complete (short)", s.CompletePhase(ctx, b.ID, cutterID, "cutter", 2, "", ip))
	// W5: a reason is required for every action; "other" needs a note.
	for _, c := range []struct {
		action       ShortAction
		reason, note string
	}{
		{ShortSplit, "", ""}, {ShortRecut, "rain", ""}, {ShortReduce, "other", ""},
	} {
		if _, err := s.ResolveShort(ctx, b.ID, c.action, c.reason, c.note, adminID, ip); !errors.Is(err, ErrInvalidInput) {
			t.Errorf("resolve %s with reason %q note %q: got %v, want invalid input", c.action, c.reason, c.note, err)
		}
	}
	rem, err := s.ResolveShort(ctx, b.ID, ShortSplit, "roll_ran_out", "", adminID, ip)
	must("split", err)
	target := 2
	must("assign", s.SetAssignments(ctx, b.ID, PhaseStitching, []AssignmentInput{{WorkerID: stitcherID, TargetQty: &target}}, adminID, ip))
	must("stitch join", s.StartPhase(ctx, b.ID, stitcherID, "stitcher", ip))
	must("stitch join again (no second start)", s.StartPhase(ctx, b.ID, stitcherID, "stitcher", ip))
	for i := 1; i <= 2; i++ {
		_, err := s.ScanUnit(ctx, fmt.Sprintf("%s-%03d", b.BatchCode, i), stitcherID, "stitcher", ip)
		must("stitch scan", err)
	}
	must("pack join", s.StartPhase(ctx, b.ID, packerID, "packer", ip))
	for i := 1; i <= 2; i++ {
		_, err := s.ScanUnit(ctx, fmt.Sprintf("%s-%03d", b.BatchCode, i), packerID, "packer", ip)
		must("pack scan", err)
	}

	type ev struct {
		kind, fromPhase, toPhase, toStatus string
		data                               map[string]any
	}
	rows, err := pool.Query(ctx, `SELECT kind::text, COALESCE(from_phase::text,''), COALESCE(to_phase::text,''),
		COALESCE(to_status::text,''), data FROM batch_events WHERE batch_id = $1 ORDER BY id`, b.ID)
	must("events", err)
	var got []ev
	for rows.Next() {
		var e ev
		var raw []byte
		must("scan", rows.Scan(&e.kind, &e.fromPhase, &e.toPhase, &e.toStatus, &raw))
		must("json", json.Unmarshal(raw, &e.data))
		got = append(got, e)
	}
	rows.Close()

	want := []struct{ kind, toPhase, toStatus string }{
		{"created", "cutting", "pending"},
		{"cut_started", "cutting", "in_progress"},
		{"cut_completed", "stitching", "awaiting_assignment"},
		{"short_resolved", "stitching", "awaiting_assignment"},
		{"assigned", "stitching", "pending"},
		{"stitching_started", "stitching", "in_progress"},
		{"stitching_completed", "packing", "pending"},
		{"packing_started", "packing", "in_progress"},
		{"completed", "completed", "completed"},
	}
	if len(got) != len(want) {
		t.Fatalf("events = %+v, want %d", got, len(want))
	}
	for i, w := range want {
		if got[i].kind != w.kind || got[i].toPhase != w.toPhase || got[i].toStatus != w.toStatus {
			t.Errorf("event %d = %s→%s/%s, want %s→%s/%s", i, got[i].kind, got[i].toPhase, got[i].toStatus, w.kind, w.toPhase, w.toStatus)
		}
	}
	if d := got[2].data; d["short"] != true || d["cut"] != float64(2) {
		t.Errorf("cut_completed data = %v", d)
	}
	if d := got[3].data; d["action"] != "split" || d["reason"] != "roll_ran_out" || d["remainder"] != rem {
		t.Errorf("short_resolved data = %v", d)
	}
	if after, _ := got[4].data["after"].([]any); len(after) != 1 {
		t.Errorf("assigned data = %v", got[4].data)
	} else if a := after[0].(map[string]any); a["target_qty"] != float64(2) || a["worker_id"] != stitcherID.String() {
		t.Errorf("assigned after = %v", a)
	}

	var remParent string
	one(fmt.Sprintf(`SELECT data->>'parent' FROM batch_events e JOIN batches r ON r.id = e.batch_id
		WHERE r.batch_code = '%s' AND e.kind = 'created'`, rem), &remParent)
	if remParent != b.ID.String() {
		t.Errorf("remainder created.parent = %q, want %s", remParent, b.ID)
	}

	// D5: counted once by its completion event; a later touch of updated_at doesn't matter.
	if n := statsToday(); n != before+1 {
		t.Errorf("completed today = %d, want %d", n, before+1)
	}
}
