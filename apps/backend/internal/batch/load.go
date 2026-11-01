package batch

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/factorytime"
)

// StitcherLoad is one active stitcher's current workload, for the assign panel (U3).
type StitcherLoad struct {
	WorkerID uuid.UUID `json:"worker_id"`
	Name     string    `json:"name"`
	// OpenMats: mats still to stitch across live stitching batches (pending / in_progress).
	// Quota assignment → max(target − own stitched, 0); shared pile (no target) → every
	// unstitched mat of the batch, since nobody owns a fixed part.
	OpenMats    int        `json:"open_mats"`
	OpenBatches int        `json:"open_batches"` // live batches with OpenMats > 0 for this worker
	OnFloor     bool       `json:"on_floor"`     // has joined a live stitching batch (open phase log)
	LastScanAt  *time.Time `json:"last_scan_at"` // last stitching scan, any batch
	MatsToday   int        `json:"mats_today"`   // stitched since the start of the factory day
}

// StitcherLoads lists active stitchers, least open work first, then on-floor first, then by name.
func (s *Service) StitcherLoads(ctx context.Context, now time.Time) ([]StitcherLoad, error) {
	rows, err := s.pool.Query(ctx, `
		WITH live AS (
		  SELECT ba.worker_id,
		         CASE WHEN ba.target_qty IS NULL
		              THEN (SELECT COUNT(*) FROM batch_units bu
		                    WHERE bu.batch_id = ba.batch_id AND bu.stitched_at IS NULL)
		              ELSE GREATEST(ba.target_qty - (SELECT COUNT(*) FROM batch_units bu
		                    WHERE bu.batch_id = ba.batch_id AND bu.stitched_by = ba.worker_id AND NOT bu.prestitched), 0)
		         END AS left_qty
		  FROM batch_assignments ba
		  JOIN batches b ON b.id = ba.batch_id
		  WHERE ba.phase = 'stitching' AND b.current_phase = 'stitching'
		    AND b.status IN ('pending', 'in_progress')
		), agg AS (
		  SELECT worker_id, SUM(left_qty)::int AS open_mats,
		         COUNT(*) FILTER (WHERE left_qty > 0)::int AS open_batches
		  FROM live GROUP BY worker_id
		)
		SELECT w.id, w.name,
		       COALESCE(a.open_mats, 0), COALESCE(a.open_batches, 0),
		       EXISTS (SELECT 1 FROM phase_logs pl JOIN batches b ON b.id = pl.batch_id
		               WHERE pl.worker_id = w.id AND pl.phase = 'stitching' AND pl.completed_at IS NULL
		                 AND b.current_phase = 'stitching' AND b.status IN ('pending', 'in_progress')) AS on_floor,
		       (SELECT MAX(bu.stitched_at) FROM batch_units bu WHERE bu.stitched_by = w.id),
		       (SELECT COUNT(*)::int FROM batch_units bu WHERE bu.stitched_by = w.id AND bu.stitched_at >= $1)
		FROM workers w
		LEFT JOIN agg a ON a.worker_id = w.id
		WHERE w.station = 'stitcher' AND w.is_active
		ORDER BY 3, on_floor DESC, w.name
	`, factorytime.StartOfDay(now))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []StitcherLoad{}
	for rows.Next() {
		var l StitcherLoad
		if err := rows.Scan(&l.WorkerID, &l.Name, &l.OpenMats, &l.OpenBatches, &l.OnFloor, &l.LastScanAt, &l.MatsToday); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}
