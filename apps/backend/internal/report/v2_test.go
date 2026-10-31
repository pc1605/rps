package report

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/batch"
	"github.com/pc1605/rps/apps/backend/internal/factorytime"
	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// TestReportsV2 runs one batch through the pipeline and checks the reports move by exactly its numbers
// (deltas, so other rows in rps_test don't matter), plus a stuck batch and the threshold setting.
func TestReportsV2(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	upload := t.TempDir()
	bs := batch.NewService(pool, upload)
	rs := NewService(pool)
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

	var groupID, carID int
	sfx := time.Now().UnixNano()
	if err := pool.QueryRow(ctx, `INSERT INTO consumption_groups (name) VALUES ($1) RETURNING id`,
		fmt.Sprintf("T reports %d", sfx)).Scan(&groupID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		INSERT INTO car_models (brand_id, name, size_class, pieces_per_set, product_line_id, consumption_group_id)
		SELECT (SELECT id FROM car_brands LIMIT 1), $1, 'medium', 4, (SELECT id FROM product_lines LIMIT 1), $2
		RETURNING id`, fmt.Sprintf("T reports car %d", sfx), groupID).Scan(&carID); err != nil {
		t.Fatal(err)
	}
	var made []uuid.UUID
	var origStuck []byte
	one(`SELECT value FROM app_settings WHERE key = 'stuck_hours'`, &origStuck)
	t.Cleanup(func() {
		for _, id := range made {
			_, _ = pool.Exec(ctx, `DELETE FROM batches WHERE id = $1`, id)
		}
		_, _ = pool.Exec(ctx, `DELETE FROM car_models WHERE id = $1`, carID)
		_, _ = pool.Exec(ctx, `DELETE FROM consumption_groups WHERE id = $1`, groupID)
		_, _ = pool.Exec(ctx, `UPDATE app_settings SET value = $1 WHERE key = 'stuck_hours'`, origStuck)
	})
	must := func(what string, err error) {
		t.Helper()
		if err != nil {
			t.Fatalf("%s: %v", what, err)
		}
	}

	today := factorytime.StartOfDay(time.Now())
	from, to := today.AddDate(0, 0, -6), today.AddDate(0, 0, 1)
	ov0, err := rs.Overview(ctx, from, to)
	must("overview before", err)
	q0, err := rs.Quality(ctx, from, to)
	must("quality before", err)
	wo0, err := rs.WorkerOutput(ctx, from, to)
	must("output before", err)
	byWorker := func(ws []WorkerOutput, id uuid.UUID) WorkerOutput {
		for _, w := range ws {
			if w.WorkerID == id {
				return w
			}
		}
		t.Fatalf("worker %s missing from output", id)
		return WorkerOutput{}
	}

	// Batch A: 2 mats through the whole pipeline; mat 1 goes to rework once (stitching fault) and is fixed.
	a, err := bs.Create(ctx, batch.CreateInput{CarModelID: carID, Quantity: 2}, adminID, "owner", ip)
	must("create A", err)
	made = append(made, a.ID)
	must("cut start", bs.StartPhase(ctx, a.ID, cutterID, "cutter", ip))
	must("cut", bs.CompletePhase(ctx, a.ID, cutterID, "cutter", 2, "", ip))
	two := 2
	must("assign", bs.SetAssignments(ctx, a.ID, batch.PhaseStitching, []batch.AssignmentInput{{WorkerID: stitcherID, TargetQty: &two}}, adminID, ip))
	must("stitch join", bs.StartPhase(ctx, a.ID, stitcherID, "stitcher", ip))
	for i := 1; i <= 2; i++ {
		_, err := bs.ScanUnit(ctx, fmt.Sprintf("%s-%03d", a.BatchCode, i), stitcherID, "stitcher", ip)
		must("stitch scan", err)
	}
	must("pack join", bs.StartPhase(ctx, a.ID, packerID, "packer", ip))
	u1 := fmt.Sprintf("%s-%03d", a.BatchCode, 1)
	photo := filepath.Join(upload, "p.jpg")
	must("photo", os.WriteFile(photo, []byte("x"), 0o600))
	_, err = bs.FlagRework(ctx, u1, packerID, "packer", []string{"stitching_fault"}, nil, []string{photo}, ip)
	must("flag", err)
	_, err = bs.ScanUnit(ctx, u1, stitcherID, "stitcher", ip) // the stitcher fixes it
	must("fix", err)
	for i := 1; i <= 2; i++ {
		_, err := bs.ScanUnit(ctx, fmt.Sprintf("%s-%03d", a.BatchCode, i), packerID, "packer", ip)
		must("pack scan", err)
	}

	// Batch B: created 30 h ago, never touched → stuck in cutting (threshold 24 h).
	b, err := bs.Create(ctx, batch.CreateInput{CarModelID: carID, Quantity: 1}, adminID, "owner", ip)
	must("create B", err)
	made = append(made, b.ID)
	_, err = pool.Exec(ctx, `UPDATE batches SET created_at = NOW() - INTERVAL '30 hours' WHERE id = $1`, b.ID)
	must("age B", err)
	_, err = pool.Exec(ctx, `UPDATE batch_events SET at = NOW() - INTERVAL '30 hours' WHERE batch_id = $1`, b.ID)
	must("age B events", err)

	ov, err := rs.Overview(ctx, from, to)
	must("overview", err)
	if d := ov.Totals.Cut - ov0.Totals.Cut; d != 2 {
		t.Errorf("cut delta = %d, want 2", d)
	}
	if d := ov.Totals.Stitched - ov0.Totals.Stitched; d != 2 {
		t.Errorf("stitched delta = %d, want 2", d)
	}
	if d := ov.Totals.Packed - ov0.Totals.Packed; d != 2 {
		t.Errorf("packed delta = %d, want 2", d)
	}
	if len(ov.Days) != 7 || ov.Days[6].Day != dayStr(today) {
		t.Errorf("days = %d, last %+v", len(ov.Days), ov.Days[len(ov.Days)-1])
	}
	if dp, df := ov.FpyPacked-ov0.FpyPacked, ov.FpyFirstPass-ov0.FpyFirstPass; dp != 2 || df != 1 {
		t.Errorf("fpy delta packed %d first-pass %d, want 2 / 1", dp, df)
	}
	var item *ItemMix
	for i := range ov.Items {
		if ov.Items[i].CarModelID == carID {
			item = &ov.Items[i]
		}
	}
	if item == nil || item.Packed != 2 {
		t.Errorf("item mix for test car = %+v", item)
	}
	if ov.StuckCount-ov0.StuckCount != 1 || ov.Wip[0].Stage != "cutting" || ov.Wip[0].Stuck-ov0.Wip[0].Stuck != 1 ||
		ov.Wip[0].Ageing[2]-ov0.Wip[0].Ageing[2] != 1 {
		t.Errorf("wip/stuck: count %d→%d, cutting %+v → %+v", ov0.StuckCount, ov.StuckCount, ov0.Wip[0], ov.Wip[0])
	}

	stuck, err := rs.Stuck(ctx)
	must("stuck", err)
	found := false
	for _, s := range stuck {
		if s.BatchID == b.ID {
			found = s.Stage == "cutting" && s.ThresholdHours == 24 && s.IdleHours >= 29
		}
		if s.BatchID == a.ID {
			t.Error("completed batch listed as stuck")
		}
	}
	if !found {
		t.Errorf("stuck batch B missing or wrong: %+v", stuck)
	}

	// Raising the cutting threshold above its idle time un-sticks it.
	_, err = rs.PutStuckHours(ctx, StuckHours{Cutting: 1, AwaitingAssignment: 0, Stitching: 48, Packing: 48}, adminID, "owner", ip)
	if !errors.Is(err, ErrInvalid) {
		t.Errorf("threshold 0: got %v, want ErrInvalid", err)
	}
	_, err = rs.PutStuckHours(ctx, StuckHours{Cutting: 72, AwaitingAssignment: 24, Stitching: 48, Packing: 48}, adminID, "owner", ip)
	must("put thresholds", err)
	st, err := rs.Settings(ctx)
	must("settings", err)
	if st.StuckHours.Cutting != 72 {
		t.Errorf("settings = %+v", st.StuckHours)
	}
	stuck, err = rs.Stuck(ctx)
	must("stuck after", err)
	for _, s := range stuck {
		if s.BatchID == b.ID {
			t.Error("batch B still stuck with a 72 h threshold")
		}
	}

	// Workers.
	wo, err := rs.WorkerOutput(ctx, from, to)
	must("output", err)
	if d := byWorker(wo, cutterID).Mats - byWorker(wo0, cutterID).Mats; d != 2 {
		t.Errorf("cutter mats delta = %d, want 2", d)
	}
	sw, sw0 := byWorker(wo, stitcherID), byWorker(wo0, stitcherID)
	if sw.Mats-sw0.Mats != 2 || sw.ReworkRounds-sw0.ReworkRounds != 1 ||
		sw.QuotaTarget-sw0.QuotaTarget != 2 || sw.QuotaDone-sw0.QuotaDone != 2 || sw.QuotaBatches-sw0.QuotaBatches != 1 {
		t.Errorf("stitcher output %+v → %+v", sw0, sw)
	}
	if d := byWorker(wo, packerID).Mats - byWorker(wo0, packerID).Mats; d != 2 {
		t.Errorf("packer mats delta = %d, want 2", d)
	}

	// Quality.
	q, err := rs.Quality(ctx, from, to)
	must("quality", err)
	if q.ReworkRounds-q0.ReworkRounds != 1 || q.FixedCount-q0.FixedCount != 1 || q.CutCompletions-q0.CutCompletions != 1 {
		t.Errorf("quality rounds %d→%d fixed %d→%d cuts %d→%d", q0.ReworkRounds, q.ReworkRounds,
			q0.FixedCount, q.FixedCount, q0.CutCompletions, q.CutCompletions)
	}
	count := func(rs []ReasonCount, r string) int {
		for _, x := range rs {
			if x.Reason == r {
				return x.Count
			}
		}
		return 0
	}
	if count(q.ByReason, "stitching_fault")-count(q0.ByReason, "stitching_fault") != 1 {
		t.Errorf("by reason %v → %v", q0.ByReason, q.ByReason)
	}
}
