package report

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// WorkerProductivity aggregates completed phase_logs per worker in [from, to).
// Workers with zero output in range still appear (LEFT JOIN) — absence is
// information for an owner.
func (s *Service) WorkerProductivity(ctx context.Context, from, to time.Time) ([]WorkerProductivity, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			w.id, w.name, w.station::text, w.is_active,
			COUNT(pl.id) FILTER (WHERE pl.completed_at IS NOT NULL),
			COALESCE(SUM(pl.quantity_completed) FILTER (WHERE pl.completed_at IS NOT NULL), 0),
			COALESCE(AVG(EXTRACT(EPOCH FROM (pl.completed_at - pl.started_at)))
				FILTER (WHERE pl.completed_at IS NOT NULL), 0)::int,
			EXISTS (
				SELECT 1 FROM phase_logs op
				WHERE op.worker_id = w.id AND op.completed_at IS NULL
			)
		FROM workers w
		LEFT JOIN phase_logs pl
			ON pl.worker_id = w.id
			AND pl.started_at >= $1
			AND pl.started_at < $2
		GROUP BY w.id, w.name, w.station, w.is_active
		ORDER BY 6 DESC, w.name ASC
	`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []WorkerProductivity{}
	for rows.Next() {
		var w WorkerProductivity
		if err := rows.Scan(&w.WorkerID, &w.WorkerName, &w.Station, &w.IsActive,
			&w.BatchesDone, &w.PiecesDone, &w.AvgDurationSecs, &w.CurrentlyWorking); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}