package worker

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/factorytime"
	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// TestMySummary pins GET /worker/me/summary: today, this week (from Monday), rework returned / open.
func TestMySummary(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	s := NewService(pool)
	var adminID, packerID uuid.UUID
	var carID int
	for q, dst := range map[string]any{
		`SELECT id FROM users LIMIT 1`:                            &adminID,
		`SELECT id FROM workers WHERE station = 'packer' LIMIT 1`: &packerID,
		`SELECT id FROM car_models LIMIT 1`:                       &carID,
	} {
		if err := pool.QueryRow(ctx, q).Scan(dst); err != nil {
			t.Fatal(err)
		}
	}
	w, err := s.Create(ctx, CreateInput{Name: fmt.Sprintf("T me %d", time.Now().UnixNano()), Station: "stitcher", PIN: "4321"}, adminID, "owner", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	var batchID uuid.UUID
	code := fmt.Sprintf("T-%d", time.Now().UnixNano()%1e9)
	if err := pool.QueryRow(ctx, `
		INSERT INTO batches (batch_code, car_model_id, quantity, cut_qty, current_phase, status, created_by)
		VALUES ($1, $2, 4, 4, 'stitching', 'in_progress', $3) RETURNING id`, code, carID, adminID).Scan(&batchID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM batches WHERE id = $1`, batchID)
		_, _ = pool.Exec(ctx, `DELETE FROM workers WHERE id = $1`, w.ID)
	})

	// A Wednesday noon (factory time): 2 stitched today, 1 on Monday, 1 the Sunday before (last week).
	loc := factorytime.Location()
	wed := time.Date(2026, 10, 28, 12, 0, 0, 0, loc)
	at := []time.Time{wed.Add(-time.Hour), wed.Add(-2 * time.Hour), wed.AddDate(0, 0, -2), wed.AddDate(0, 0, -3)}
	for i, ts := range at {
		if _, err := pool.Exec(ctx, `INSERT INTO batch_units (batch_id, unit_code, unit_number, stitched_by, stitched_at, status)
			VALUES ($1, $2, $3, $4, $5, $6)`, batchID, fmt.Sprintf("%s-%03d", code, i+1), i+1, w.ID, ts,
			map[bool]string{true: "rework", false: "pending"}[i == 0]); err != nil {
			t.Fatal(err)
		}
	}
	// unit 1 came back today (open, routed to the stitcher)
	if _, err := pool.Exec(ctx, `INSERT INTO rework_logs (unit_id, batch_id, round, reasons, route, flagged_by, flagged_at)
		SELECT id, batch_id, 1, '{stain}', 'stitcher', $2, $3 FROM batch_units WHERE unit_code = $1`,
		code+"-001", packerID, wed.Add(-30*time.Minute)); err != nil {
		t.Fatal(err)
	}

	got, err := s.MySummary(ctx, w.ID, wed)
	if err != nil {
		t.Fatal(err)
	}
	if got.Today != 2 || got.Week != 3 || got.WeekOf != "2026-10-26" || len(got.Days) != 2 {
		t.Fatalf("summary = today %d week %d of %s days %d", got.Today, got.Week, got.WeekOf, len(got.Days))
	}
	if got.ReworkReturned == nil || *got.ReworkReturned != 1 || got.ReworkOpen == nil || *got.ReworkOpen != 1 || got.Flagged != nil {
		t.Fatalf("rework = %v / %v, flagged %v", got.ReworkReturned, got.ReworkOpen, got.Flagged)
	}
	if ws := weekStart(time.Date(2026, 11, 1, 23, 0, 0, 0, loc)); ws.Format("2006-01-02") != "2026-10-26" {
		t.Fatalf("Sunday's week starts %s", ws.Format("2006-01-02"))
	}
}
