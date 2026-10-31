package report

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/pc1605/rps/apps/backend/internal/factorytime"
)

// Reports v2 (R1): counts mats from per-mat scan facts (batch_units), time from batch_events.

const carName = `cb.name || ' ' || cm.name`

func dayStr(t time.Time) string { return t.In(factorytime.Location()).Format("2006-01-02") }

func rangeOf(from, to time.Time) Range {
	return Range{From: dayStr(from), To: dayStr(to.Add(-time.Hour))}
}

func collect[T any](rows pgx.Rows, scan func(*T) error) ([]T, error) {
	defer rows.Close()
	out := []T{}
	for rows.Next() {
		var v T
		if err := scan(&v); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// ───── live stages (WIP + stuck) ─────

// liveSQL: one row per live batch with its stage, when it entered the stage and its last activity
// (newest event, scan, claim or rework step). $1..$4 = stuck hours for cutting, awaiting, stitching, packing.
const liveSQL = `
WITH open AS (
  SELECT b.id, b.batch_code, b.quantity, b.current_phase, b.created_at, ` + carName + ` AS car,
         CASE WHEN b.current_phase = 'stitching' AND b.status = 'awaiting_assignment' THEN 'awaiting_assignment'
              ELSE b.current_phase::text END AS stage
  FROM batches b
  JOIN car_models cm ON cm.id = b.car_model_id
  JOIN car_brands cb ON cb.id = cm.brand_id
  WHERE b.status NOT IN ('completed', 'cancelled') AND b.current_phase <> 'completed'
), live AS (
  SELECT o.*,
    COALESCE(
      (SELECT MAX(e.at) FROM batch_events e WHERE e.batch_id = o.id AND e.to_phase = o.current_phase
         AND e.to_status = CASE o.stage WHEN 'awaiting_assignment' THEN 'awaiting_assignment'::batch_status
                                        ELSE 'pending'::batch_status END),
      (SELECT MAX(e.at) FROM batch_events e WHERE e.batch_id = o.id AND e.to_phase = o.current_phase),
      o.created_at) AS entered_at,
    GREATEST(o.created_at,
      (SELECT MAX(e.at) FROM batch_events e WHERE e.batch_id = o.id),
      (SELECT MAX(GREATEST(bu.stitched_at, bu.packed_at)) FROM batch_units bu WHERE bu.batch_id = o.id),
      (SELECT MAX(pl.started_at) FROM phase_logs pl WHERE pl.batch_id = o.id),
      (SELECT MAX(GREATEST(rl.flagged_at, rl.decided_at, rl.fixed_at)) FROM rework_logs rl WHERE rl.batch_id = o.id)
    ) AS last_activity,
    CASE o.stage WHEN 'cutting' THEN $1::int WHEN 'awaiting_assignment' THEN $2::int
                 WHEN 'stitching' THEN $3::int ELSE $4::int END AS threshold
  FROM open o
)
SELECT id, batch_code, car, quantity, stage, entered_at, last_activity, threshold,
       EXTRACT(EPOCH FROM NOW() - entered_at) / 3600,
       EXTRACT(EPOCH FROM NOW() - last_activity) / 3600
FROM live`

type liveRow struct {
	StuckBatch
	stageAgeHours float64
}

func (s *Service) live(ctx context.Context, q querier2, h StuckHours) ([]liveRow, error) {
	rows, err := q.Query(ctx, liveSQL+` ORDER BY last_activity`, h.Cutting, h.AwaitingAssignment, h.Stitching, h.Packing)
	if err != nil {
		return nil, fmt.Errorf("live batches: %w", err)
	}
	return collect(rows, func(r *liveRow) error {
		return rows.Scan(&r.BatchID, &r.BatchCode, &r.CarName, &r.Quantity, &r.Stage, &r.EnteredAt, &r.LastActivityAt,
			&r.ThresholdHours, &r.stageAgeHours, &r.IdleHours)
	})
}

type querier2 interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func (r liveRow) stuck() bool { return r.IdleHours >= float64(r.ThresholdHours) }

// Stuck lists live batches idle past their stage's threshold, longest idle first.
func (s *Service) Stuck(ctx context.Context) ([]StuckBatch, error) {
	h, err := stuckHours(ctx, s.pool)
	if err != nil {
		return nil, err
	}
	all, err := s.live(ctx, s.pool, h)
	if err != nil {
		return nil, err
	}
	out := []StuckBatch{}
	for _, r := range all { // already ordered by last activity (oldest first)
		if r.stuck() {
			out = append(out, r.StuckBatch)
		}
	}
	return out, nil
}

var stages = []string{"cutting", "awaiting_assignment", "stitching", "packing"}

func wip(rows []liveRow) ([]WipStage, int) {
	by := map[string]*WipStage{}
	out := make([]WipStage, len(stages))
	for i, st := range stages {
		out[i] = WipStage{Stage: st}
		by[st] = &out[i]
	}
	stuck := 0
	for _, r := range rows {
		w := by[r.Stage]
		if w == nil {
			continue
		}
		w.Batches++
		w.Mats += r.Quantity
		switch a := r.stageAgeHours; {
		case a < 4:
			w.Ageing[0]++
		case a < 24:
			w.Ageing[1]++
		case a < 72:
			w.Ageing[2]++
		default:
			w.Ageing[3]++
		}
		if r.stuck() {
			w.Stuck++
			stuck++
		}
	}
	return out, stuck
}

// ───── overview ─────

func (s *Service) totals(ctx context.Context, from, to time.Time) (Totals, error) {
	var t Totals
	err := s.pool.QueryRow(ctx, `
		SELECT COALESCE((SELECT SUM((data->>'cut')::int) FROM batch_events
		                  WHERE kind = 'cut_completed' AND at >= $1 AND at < $2), 0),
		       (SELECT COUNT(*) FROM batch_units WHERE stitched_at >= $1 AND stitched_at < $2),
		       (SELECT COUNT(*) FROM batch_units WHERE packed_at >= $1 AND packed_at < $2)`,
		from, to).Scan(&t.Cut, &t.Stitched, &t.Packed)
	return t, err
}

func (s *Service) Overview(ctx context.Context, from, to time.Time) (*Overview, error) {
	tz := factorytime.Name()
	ov := &Overview{Range: rangeOf(from, to)}

	rows, err := s.pool.Query(ctx, `
		WITH days AS (SELECT d::date AS day FROM generate_series($2::date, $3::date, interval '1 day') d),
		cut AS (SELECT (at AT TIME ZONE $1)::date AS day, SUM((data->>'cut')::int) AS n FROM batch_events
		        WHERE kind = 'cut_completed' AND at >= $4 AND at < $5 GROUP BY 1),
		st AS (SELECT (stitched_at AT TIME ZONE $1)::date AS day, COUNT(*) AS n FROM batch_units
		       WHERE stitched_at >= $4 AND stitched_at < $5 GROUP BY 1),
		pk AS (SELECT (packed_at AT TIME ZONE $1)::date AS day, COUNT(*) AS n FROM batch_units
		       WHERE packed_at >= $4 AND packed_at < $5 GROUP BY 1)
		SELECT to_char(d.day, 'YYYY-MM-DD'), COALESCE(cut.n, 0), COALESCE(st.n, 0), COALESCE(pk.n, 0)
		FROM days d LEFT JOIN cut USING (day) LEFT JOIN st USING (day) LEFT JOIN pk USING (day)
		ORDER BY d.day`, tz, ov.Range.From, ov.Range.To, from, to)
	if err != nil {
		return nil, fmt.Errorf("throughput: %w", err)
	}
	if ov.Days, err = collect(rows, func(d *DayCount) error {
		return rows.Scan(&d.Day, &d.Cut, &d.Stitched, &d.Packed)
	}); err != nil {
		return nil, err
	}
	for _, d := range ov.Days {
		ov.Totals.Cut += d.Cut
		ov.Totals.Stitched += d.Stitched
		ov.Totals.Packed += d.Packed
	}
	if ov.Previous, err = s.totals(ctx, from.Add(-to.Sub(from)), from); err != nil {
		return nil, fmt.Errorf("previous totals: %w", err)
	}

	// First-pass yield: packed in range, and of those, never in a rework round.
	if err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*), COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM rework_logs rl WHERE rl.unit_id = bu.id))
		FROM batch_units bu WHERE bu.packed_at >= $1 AND bu.packed_at < $2`, from, to).
		Scan(&ov.FpyPacked, &ov.FpyFirstPass); err != nil {
		return nil, fmt.Errorf("fpy: %w", err)
	}
	rows, err = s.pool.Query(ctx, `
		SELECT to_char(date_trunc('week', bu.packed_at AT TIME ZONE $1), 'YYYY-MM-DD'), COUNT(*),
		       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM rework_logs rl WHERE rl.unit_id = bu.id))
		FROM batch_units bu WHERE bu.packed_at >= $2 AND bu.packed_at < $3
		GROUP BY 1 ORDER BY 1`, tz, from, to)
	if err != nil {
		return nil, fmt.Errorf("fpy weeks: %w", err)
	}
	if ov.FpyWeeks, err = collect(rows, func(w *FpyWeek) error { return rows.Scan(&w.Week, &w.Packed, &w.FirstPass) }); err != nil {
		return nil, err
	}

	rows, err = s.pool.Query(ctx, `
		SELECT cm.id, `+carName+`, pl.code, COUNT(*)
		FROM batch_units bu
		JOIN batches b ON b.id = bu.batch_id
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		LEFT JOIN product_lines pl ON pl.id = cm.product_line_id
		WHERE bu.packed_at >= $1 AND bu.packed_at < $2
		GROUP BY cm.id, cb.name, cm.name, pl.code
		ORDER BY 4 DESC, 2`, from, to)
	if err != nil {
		return nil, fmt.Errorf("item mix: %w", err)
	}
	if ov.Items, err = collect(rows, func(i *ItemMix) error {
		return rows.Scan(&i.CarModelID, &i.CarName, &i.ProductLine, &i.Packed)
	}); err != nil {
		return nil, err
	}

	if ov.StuckHours, err = stuckHours(ctx, s.pool); err != nil {
		return nil, err
	}
	live, err := s.live(ctx, s.pool, ov.StuckHours)
	if err != nil {
		return nil, err
	}
	ov.Wip, ov.StuckCount = wip(live)
	return ov, nil
}

// ───── workers ─────

// workerDaysSQL: per worker per factory day, mats and active seconds. $1 tz, $2/$3 range.
// Stitchers/packers: scans, active = first → last scan of the day. Cutters: completed cutting logs,
// active = start → complete (pieces counted on the completion day).
const workerDaysSQL = `
WITH acts AS (
  SELECT stitched_by AS w, stitched_at AS at FROM batch_units
  WHERE stitched_by IS NOT NULL AND stitched_at >= $2 AND stitched_at < $3
  UNION ALL
  SELECT packed_by, packed_at FROM batch_units
  WHERE packed_by IS NOT NULL AND packed_at >= $2 AND packed_at < $3
), per_day AS (
  SELECT w, (at AT TIME ZONE $1)::date AS day, COUNT(*)::int AS n,
         EXTRACT(EPOCH FROM MAX(at) - MIN(at))::int AS secs
  FROM acts GROUP BY 1, 2
  UNION ALL
  SELECT worker_id, (completed_at AT TIME ZONE $1)::date, SUM(quantity_completed)::int,
         SUM(EXTRACT(EPOCH FROM completed_at - started_at))::int
  FROM phase_logs WHERE phase = 'cutting' AND completed_at >= $2 AND completed_at < $3
  GROUP BY 1, 2
)`

func matsPerHour(mats, secs int) *float64 {
	if secs < 15*60 || mats == 0 {
		return nil
	}
	v := float64(mats) / (float64(secs) / 3600)
	v = float64(int(v*10+0.5)) / 10
	return &v
}

func (s *Service) WorkerOutput(ctx context.Context, from, to time.Time) ([]WorkerOutput, error) {
	rows, err := s.pool.Query(ctx, workerDaysSQL+`
		SELECT w.id, w.name, w.station::text, w.is_active,
		       COALESCE(SUM(pd.n), 0)::int, COUNT(DISTINCT pd.day)::int, COALESCE(SUM(pd.secs), 0)::int,
		       (SELECT COUNT(*) FROM rework_logs rl JOIN batch_units bu ON bu.id = rl.unit_id
		         WHERE bu.stitched_by = w.id AND rl.flagged_at >= $2 AND rl.flagged_at < $3)::int,
		       COALESCE(q.target, 0)::int, COALESCE(q.done, 0)::int, COALESCE(q.batches, 0)::int,
		       (SELECT COUNT(*) FROM phase_logs op WHERE op.worker_id = w.id AND op.completed_at IS NULL)::int
		FROM workers w
		LEFT JOIN per_day pd ON pd.w = w.id
		LEFT JOIN LATERAL (
		  -- quotas of batches whose stitching finished in range: delivered vs target
		  SELECT SUM(ba.target_qty) AS target, COUNT(*) AS batches,
		         SUM((SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = ba.batch_id AND bu.stitched_by = w.id)) AS done
		  FROM batch_assignments ba
		  WHERE ba.worker_id = w.id AND ba.phase = 'stitching' AND ba.target_qty IS NOT NULL
		    AND EXISTS (SELECT 1 FROM batch_events e WHERE e.batch_id = ba.batch_id AND e.kind = 'stitching_completed'
		                AND e.at >= $2 AND e.at < $3)
		) q ON true
		GROUP BY w.id, w.name, w.station, w.is_active, q.target, q.done, q.batches
		ORDER BY w.station, 5 DESC, w.name`, factorytime.Name(), from, to)
	if err != nil {
		return nil, fmt.Errorf("worker output: %w", err)
	}
	out, err := collect(rows, func(o *WorkerOutput) error {
		return rows.Scan(&o.WorkerID, &o.WorkerName, &o.Station, &o.IsActive, &o.Mats, &o.DaysWorked, &o.ActiveSecs,
			&o.ReworkRounds, &o.QuotaTarget, &o.QuotaDone, &o.QuotaBatches, &o.CurrentlyOpen)
	})
	if err != nil {
		return nil, err
	}
	for i := range out {
		out[i].MatsPerHour = matsPerHour(out[i].Mats, out[i].ActiveSecs)
	}
	return out, nil
}

// ───── quality ─────

func (s *Service) Quality(ctx context.Context, from, to time.Time) (*Quality, error) {
	q := &Quality{Range: rangeOf(from, to)}
	reasons := func(sql string) ([]ReasonCount, error) {
		rows, err := s.pool.Query(ctx, sql, from, to)
		if err != nil {
			return nil, err
		}
		return collect(rows, func(r *ReasonCount) error { return rows.Scan(&r.Reason, &r.Count) })
	}
	var err error
	if err = s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM rework_logs WHERE flagged_at >= $1 AND flagged_at < $2`, from, to).
		Scan(&q.ReworkRounds); err != nil {
		return nil, err
	}
	if q.ByReason, err = reasons(`
		SELECT r, COUNT(*)::int FROM rework_logs rl, unnest(rl.reasons) r
		WHERE rl.flagged_at >= $1 AND rl.flagged_at < $2 GROUP BY r ORDER BY 2 DESC, 1`); err != nil {
		return nil, fmt.Errorf("rework reasons: %w", err)
	}
	rows, err := s.pool.Query(ctx, `
		SELECT w.id, w.name,
		       (SELECT COUNT(*) FROM rework_logs rl JOIN batch_units bu ON bu.id = rl.unit_id
		         WHERE bu.stitched_by = w.id AND rl.flagged_at >= $1 AND rl.flagged_at < $2)::int AS rounds,
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.stitched_by = w.id
		         AND bu.stitched_at >= $1 AND bu.stitched_at < $2)::int AS stitched
		FROM workers w WHERE w.station = 'stitcher'
		ORDER BY 3 DESC, 4 DESC, w.name`, from, to)
	if err != nil {
		return nil, fmt.Errorf("rework by stitcher: %w", err)
	}
	all, err := collect(rows, func(r *StitcherRework) error { return rows.Scan(&r.WorkerID, &r.WorkerName, &r.Rounds, &r.Stitched) })
	if err != nil {
		return nil, err
	}
	q.ByStitcher = []StitcherRework{}
	for _, r := range all {
		if r.Rounds > 0 || r.Stitched > 0 {
			q.ByStitcher = append(q.ByStitcher, r)
		}
	}
	if err = s.pool.QueryRow(ctx, `
		SELECT COUNT(*), AVG(EXTRACT(EPOCH FROM fixed_at - COALESCE(decided_at, flagged_at)) / 3600)
		FROM rework_logs WHERE fixed_at >= $1 AND fixed_at < $2`, from, to).Scan(&q.FixedCount, &q.AvgFixHours); err != nil {
		return nil, fmt.Errorf("fix time: %w", err)
	}
	if q.AvgFixHours != nil {
		v := float64(int(*q.AvgFixHours*10+0.5)) / 10
		q.AvgFixHours = &v
	}

	if err = s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM batch_events WHERE kind = 'cut_completed' AND at >= $1 AND at < $2`,
		from, to).Scan(&q.CutCompletions); err != nil {
		return nil, err
	}
	rows, err = s.pool.Query(ctx, `
		SELECT COALESCE(data->>'action', '?'), COALESCE(NULLIF(data->>'reason', ''), 'unknown'), COUNT(*)::int
		FROM batch_events WHERE kind = 'short_resolved' AND at >= $1 AND at < $2
		GROUP BY 1, 2 ORDER BY 3 DESC, 1, 2`, from, to)
	if err != nil {
		return nil, fmt.Errorf("short cuts: %w", err)
	}
	if q.ShortCuts, err = collect(rows, func(c *ShortCount) error { return rows.Scan(&c.Action, &c.Reason, &c.Count) }); err != nil {
		return nil, err
	}

	rows, err = s.pool.Query(ctx, `
		SELECT rl.decision, cm.id, `+carName+`, COUNT(*)::int
		FROM rework_logs rl
		JOIN batches b ON b.id = rl.batch_id
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		WHERE rl.decision IN ('write_off', 'recut') AND rl.decided_at >= $1 AND rl.decided_at < $2
		GROUP BY rl.decision, cm.id, cb.name, cm.name ORDER BY 4 DESC, 3`, from, to)
	if err != nil {
		return nil, fmt.Errorf("losses: %w", err)
	}
	if q.Losses, err = collect(rows, func(l *LossRow) error { return rows.Scan(&l.Decision, &l.CarModelID, &l.CarName, &l.Count) }); err != nil {
		return nil, err
	}
	if q.LossByReason, err = reasons(`
		SELECT r, COUNT(*)::int FROM rework_logs rl, unnest(rl.reasons) r
		WHERE rl.decision IN ('write_off', 'recut') AND rl.decided_at >= $1 AND rl.decided_at < $2
		GROUP BY r ORDER BY 2 DESC, 1`); err != nil {
		return nil, fmt.Errorf("loss reasons: %w", err)
	}
	return q, nil
}
