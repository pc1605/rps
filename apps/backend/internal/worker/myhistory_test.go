package worker

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/factorytime"
	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// TestMyHistory pins GET /worker/me/history (M1, D42): the phone's month shows exactly what the admin's
// Service.Summary shows for the same worker and days. All times are fixed dates, never relative to the clock.
func TestMyHistory(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	s := NewService(pool)
	var adminID uuid.UUID
	var carID int
	for q, dst := range map[string]any{
		`SELECT id FROM users LIMIT 1`:      &adminID,
		`SELECT id FROM car_models LIMIT 1`: &carID,
	} {
		if err := pool.QueryRow(ctx, q).Scan(dst); err != nil {
			t.Fatal(err)
		}
	}
	stamp := time.Now().UnixNano()
	ids := map[string]uuid.UUID{}
	for _, st := range []string{"stitcher", "packer", "cutter"} {
		w, err := s.Create(ctx, CreateInput{Name: fmt.Sprintf("T hist %s %d", st, stamp), Station: st, PIN: "4321"}, adminID, "owner", "127.0.0.1")
		if err != nil {
			t.Fatal(err)
		}
		ids[st] = w.ID
	}
	var batchID uuid.UUID
	code := fmt.Sprintf("T-%d", stamp%1e9)
	if err := pool.QueryRow(ctx, `
		INSERT INTO batches (batch_code, car_model_id, quantity, cut_qty, current_phase, status, created_by)
		VALUES ($1, $2, 6, 6, 'stitching', 'in_progress', $3) RETURNING id`, code, carID, adminID).Scan(&batchID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM batches WHERE id = $1`, batchID) // units and logs cascade
		for _, id := range ids {
			_, _ = pool.Exec(ctx, `DELETE FROM workers WHERE id = $1`, id)
		}
	})

	loc := factorytime.Location()
	now := time.Date(2026, 10, 28, 12, 0, 0, 0, loc)
	day := func(m time.Month, d, h, min int) time.Time { return time.Date(2026, m, d, h, min, 0, 0, loc) }

	// Nobody has output yet: an empty month, and first_month is the current month.
	empty, err := s.MyHistory(ctx, ids["stitcher"], "", now)
	if err != nil {
		t.Fatal(err)
	}
	if empty.Month != "2026-10" || empty.FirstMonth != "2026-10" || empty.Total != 0 || empty.DaysWorked != 0 || empty.Days == nil || len(empty.Days) != 0 {
		t.Fatalf("empty month = %+v", empty)
	}

	// Stitched: 2 on 5 Oct, 2 on 20 Oct, 1 on 30 Sep 23:30 (the previous factory month), 1 on 30 Oct (after "now").
	stitched := []time.Time{day(10, 5, 10, 0), day(10, 5, 11, 0), day(10, 20, 10, 0), day(10, 20, 16, 0), day(9, 30, 23, 30), day(10, 30, 9, 0)}
	for i, ts := range stitched {
		if _, err := pool.Exec(ctx, `INSERT INTO batch_units (batch_id, unit_code, unit_number, stitched_by, stitched_at)
			VALUES ($1, $2, $3, $4, $5)`, batchID, fmt.Sprintf("%s-%03d", code, i+1), i+1, ids["stitcher"], ts); err != nil {
			t.Fatal(err)
		}
	}

	// sameAsAdmin: the month on the phone equals Service.Summary for the same days.
	sameAsAdmin := func(month string, from, to time.Time, wantTotal int) *MyHistory {
		t.Helper()
		got, err := s.MyHistory(ctx, ids["stitcher"], month, now)
		if err != nil {
			t.Fatal(err)
		}
		admin, err := s.Summary(ctx, ids["stitcher"], from, to)
		if err != nil {
			t.Fatal(err)
		}
		if got.Total != wantTotal || got.Total != admin.Total || got.DaysWorked != len(admin.Days) || len(got.Days) != len(admin.Days) || got.Unit != admin.Unit {
			t.Fatalf("%s: phone total %d on %d days (%s), admin total %d on %d days (%s), want %d",
				month, got.Total, len(got.Days), got.Unit, admin.Total, len(admin.Days), admin.Unit, wantTotal)
		}
		for i, d := range admin.Days {
			if got.Days[i].Day != d.Day || got.Days[i].Mats != d.Mats {
				t.Fatalf("%s day %d: phone %+v, admin %s = %d", month, i, got.Days[i], d.Day, d.Mats)
			}
		}
		return got
	}
	tomorrow := day(10, 29, 0, 0)
	oct := sameAsAdmin("2026-10", day(10, 1, 0, 0), tomorrow, 4) // the current month stops at today
	if oct.Month != "2026-10" || oct.FirstMonth != "2026-09" || oct.Station != StationStitcher || oct.Unit != "mats stitched" ||
		len(oct.Days) != 2 || oct.Days[0].Day != "2026-10-05" || oct.Days[1].Day != "2026-10-20" {
		t.Fatalf("october = %+v", oct)
	}
	if def, err := s.MyHistory(ctx, ids["stitcher"], "", now); err != nil || def.Month != "2026-10" || def.Total != 4 {
		t.Fatalf("default month = %+v, %v", def, err)
	}
	sep := sameAsAdmin("2026-09", day(9, 1, 0, 0), day(10, 1, 0, 0), 1)
	if len(sep.Days) != 1 || sep.Days[0].Day != "2026-09-30" || sep.FirstMonth != "2026-09" {
		t.Fatalf("september = %+v", sep)
	}
	// A month before the first output is just empty.
	if aug := sameAsAdmin("2026-08", day(8, 1, 0, 0), day(9, 1, 0, 0), 0); aug.FirstMonth != "2026-09" {
		t.Fatalf("august = %+v", aug)
	}

	// An undone scan (the admin's undo clears stitched_by / stitched_at) disappears.
	if _, err := pool.Exec(ctx, `UPDATE batch_units SET stitched_by = NULL, stitched_at = NULL WHERE unit_code = $1`, code+"-004"); err != nil {
		t.Fatal(err)
	}
	sameAsAdmin("2026-10", day(10, 1, 0, 0), tomorrow, 3)

	// Future and malformed months are refused.
	for _, m := range []string{"2026-11", "2027-01", "2026-1", "2026-13", "2026-10-05", "nope"} {
		if _, err := s.MyHistory(ctx, ids["stitcher"], m, now); !errors.Is(err, ErrInvalidInput) {
			t.Errorf("month %q: %v", m, err)
		}
	}
	if _, err := s.MyHistory(ctx, uuid.New(), "", now); !errors.Is(err, ErrNotFound) {
		t.Errorf("unknown worker: %v", err)
	}

	// A packer and a cutter get their own unit and count.
	if _, err := pool.Exec(ctx, `UPDATE batch_units SET packed_by = $2, packed_at = $3 WHERE unit_code = $1`,
		code+"-001", ids["packer"], day(10, 6, 10, 0)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO phase_logs (batch_id, phase, worker_id, started_at, completed_at, quantity_completed)
		VALUES ($1, 'cutting', $2, $3, $4, 6)`, batchID, ids["cutter"], day(9, 29, 9, 0), day(9, 29, 10, 0)); err != nil {
		t.Fatal(err)
	}
	p, err := s.MyHistory(ctx, ids["packer"], "2026-10", now)
	if err != nil || p.Unit != "mats packed" || p.Total != 1 || p.DaysWorked != 1 || p.Days[0].Day != "2026-10-06" || p.FirstMonth != "2026-10" {
		t.Fatalf("packer = %+v, %v", p, err)
	}
	c, err := s.MyHistory(ctx, ids["cutter"], "2026-09", now)
	if err != nil || c.Unit != "pieces cut" || c.Total != 6 || c.DaysWorked != 1 || c.Days[0].Day != "2026-09-29" || c.FirstMonth != "2026-09" {
		t.Fatalf("cutter = %+v, %v", c, err)
	}
}
