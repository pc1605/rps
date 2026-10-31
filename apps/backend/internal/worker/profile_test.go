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

func TestWorkerPage(t *testing.T) {
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

	w, err := s.Create(ctx, CreateInput{Name: fmt.Sprintf("T stitcher %d", time.Now().UnixNano()), Station: "stitcher", PIN: "4321"}, adminID, "owner", "127.0.0.1")
	if err != nil {
		t.Fatalf("create worker: %v", err)
	}
	badge := w.BadgeToken
	var batchID, logID uuid.UUID
	code := fmt.Sprintf("T-%d", time.Now().UnixNano()%1e9)
	if err := pool.QueryRow(ctx, `
		INSERT INTO batches (batch_code, car_model_id, quantity, cut_qty, current_phase, status, created_by)
		VALUES ($1, $2, 3, 3, 'stitching', 'in_progress', $3) RETURNING id`, code, carID, adminID).Scan(&batchID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM batches WHERE id = $1`, batchID) // units, logs, assignments, rework cascade
		_, _ = pool.Exec(ctx, `DELETE FROM workers WHERE id = $1`, w.ID)
	})
	if _, err := pool.Exec(ctx, `
		INSERT INTO batch_units (batch_id, unit_code, unit_number, stitched_by, stitched_at)
		SELECT $1, $2 || '-' || LPAD(n::text, 3, '0'), n, CASE WHEN n <= 2 THEN $3::uuid END,
		       CASE WHEN n <= 2 THEN NOW() - (n || ' minutes')::interval END
		FROM generate_series(1, 3) n`, batchID, code, w.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO batch_assignments (batch_id, phase, worker_id, assigned_by, target_qty)
		VALUES ($1, 'stitching', $2, $3, 3)`, batchID, w.ID, adminID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO phase_logs (batch_id, phase, worker_id) VALUES ($1, 'stitching', $2) RETURNING id`,
		batchID, w.ID).Scan(&logID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO rework_logs (unit_id, batch_id, round, reasons, route, flagged_by)
		SELECT id, batch_id, 1, ARRAY['stitching_fault','stain'], 'stitcher', $2 FROM batch_units WHERE batch_id = $1 AND unit_number = 1`,
		batchID, packerID); err != nil {
		t.Fatal(err)
	}

	// Detail: open claim with my_done 2 of target 3; open rework round on my mat.
	d, err := s.Detail(ctx, w.ID)
	if err != nil {
		t.Fatalf("detail: %v", err)
	}
	if len(d.OpenClaims) != 1 || d.OpenClaims[0].MyDone != 2 || d.OpenClaims[0].TargetQty == nil || *d.OpenClaims[0].TargetQty != 3 {
		t.Errorf("open claims = %+v", d.OpenClaims)
	}
	if len(d.Assigned) != 0 {
		t.Errorf("assigned (already joined) should be empty: %+v", d.Assigned)
	}
	if len(d.OpenRework) != 1 || d.OpenRework[0].UnitCode != code+"-001" || d.OpenRework[0].AwaitingDecision {
		t.Errorf("open rework = %+v", d.OpenRework)
	}

	// Summary: 2 mats today, 1 rework round (2 reasons), rate 50 %.
	today := factorytime.StartOfDay(time.Now())
	sm, err := s.Summary(ctx, w.ID, today.AddDate(0, 0, -6), today.AddDate(0, 0, 1))
	if err != nil {
		t.Fatalf("summary: %v", err)
	}
	if sm.Total != 2 || sm.Today != 2 || sm.Last7Days != 2 || sm.Unit != "mats stitched" || len(sm.Days) != 1 {
		t.Errorf("summary totals = %+v", sm)
	}
	if sm.ReworkCaused == nil || sm.ReworkCaused.Rounds != 1 || sm.ReworkCaused.ByReason["stain"] != 1 ||
		sm.ReworkCaused.RatePct == nil || *sm.ReworkCaused.RatePct != 50 {
		t.Errorf("rework caused = %+v", sm.ReworkCaused)
	}

	// History: the stitching participation.
	h, err := s.History(ctx, w.ID, 10, "")
	if err != nil || len(h.Items) != 1 || h.Items[0].Mats != 2 || h.Items[0].ReworkCaused != 1 || h.Items[0].BatchCode != code {
		t.Errorf("history = %+v, %v", h, err)
	}
	if _, err := s.History(ctx, w.ID, 10, "nope"); !errors.Is(err, ErrInvalidInput) {
		t.Errorf("bad cursor: %v", err)
	}

	// Busy: can't deactivate or change station; a name change is fine.
	no := false
	if _, err := s.Update(ctx, w.ID, UpdateInput{IsActive: &no}, adminID, "owner", "127.0.0.1"); !errors.Is(err, ErrWorkerBusy) {
		t.Errorf("deactivate while busy: %v", err)
	}
	packer := "packer"
	if _, err := s.Update(ctx, w.ID, UpdateInput{Station: &packer}, adminID, "owner", "127.0.0.1"); !errors.Is(err, ErrWorkerBusy) {
		t.Errorf("station change while busy: %v", err)
	}
	phone := "98250 00000"
	if u, err := s.Update(ctx, w.ID, UpdateInput{Phone: &phone}, adminID, "owner", "127.0.0.1"); err != nil || u.Phone != phone {
		t.Errorf("phone: %+v %v", u, err)
	}
	// Close the claim and finish the quota → free to deactivate.
	if _, err := pool.Exec(ctx, `UPDATE phase_logs SET completed_at = NOW() WHERE id = $1`, logID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE batch_assignments SET target_qty = 2 WHERE batch_id = $1`, batchID); err != nil {
		t.Fatal(err)
	}
	if u, err := s.Update(ctx, w.ID, UpdateInput{IsActive: &no}, adminID, "owner", "127.0.0.1"); err != nil || u.IsActive {
		t.Errorf("deactivate when free: %+v %v", u, err)
	}

	// PIN reset: random 4 digits that log in (once reactivated); the old PIN no longer does.
	yes := true
	if _, err := s.Update(ctx, w.ID, UpdateInput{IsActive: &yes}, adminID, "owner", "127.0.0.1"); err != nil {
		t.Fatal(err)
	}
	pin, err := s.ResetPIN(ctx, w.ID, "", adminID, "owner", "127.0.0.1")
	if err != nil || len(pin) != 4 {
		t.Fatalf("reset pin: %q %v", pin, err)
	}
	if _, err := s.Login(ctx, badge, pin); err != nil {
		t.Errorf("login with new pin: %v", err)
	}
	if pin != "4321" {
		if _, err := s.Login(ctx, badge, "4321"); err == nil {
			t.Error("old pin still logs in")
		}
	}
	if _, err := s.ResetPIN(ctx, w.ID, "12a4", adminID, "owner", "127.0.0.1"); !errors.Is(err, ErrInvalidInput) {
		t.Errorf("bad pin: %v", err)
	}
	if _, err := s.Detail(ctx, uuid.New()); !errors.Is(err, ErrNotFound) {
		t.Errorf("unknown worker: %v", err)
	}
}
