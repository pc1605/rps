package worker

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/factorytime"
)

// MySummary is the phone's "My work" card (U3, D39): the worker's own output, no ₹ (Slice D).
type MySummary struct {
	Station Station     `json:"station"`
	Unit    string      `json:"unit"` // "pieces cut" | "mats stitched" | "mats packed"
	Today   int         `json:"today"`
	Week    int         `json:"week"`    // since Monday (factory week)
	WeekOf  string      `json:"week_of"` // that Monday, YYYY-MM-DD
	Days    []DayOutput `json:"days"`    // Monday → today, days with output only
	// Stitchers: mats they stitched that came back for rework this week, and how many wait now.
	ReworkReturned *int `json:"rework_returned,omitempty"`
	ReworkOpen     *int `json:"rework_open,omitempty"`
	// Packers: rework rounds they flagged this week.
	Flagged *int `json:"flagged,omitempty"`
}

// weekStart: Monday 00:00 (factory time) of the week containing t.
func weekStart(t time.Time) time.Time {
	d := factorytime.StartOfDay(t)
	offset := (int(d.Weekday()) + 6) % 7 // Monday = 0
	return d.AddDate(0, 0, -offset)
}

// MySummary — GET /worker/me/summary.
func (s *Service) MySummary(ctx context.Context, id uuid.UUID, now time.Time) (*MySummary, error) {
	w, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	_, unit := outputSQL(w.Station)
	from := weekStart(now)
	today := factorytime.StartOfDay(now)
	out := &MySummary{Station: w.Station, Unit: unit, WeekOf: from.Format("2006-01-02")}
	if out.Days, err = s.days(ctx, id, w.Station, from, today.AddDate(0, 0, 1)); err != nil {
		return nil, err
	}
	out.Week, _ = sum(out.Days)
	if n := len(out.Days); n > 0 && out.Days[n-1].Day == today.Format("2006-01-02") {
		out.Today = out.Days[n-1].Mats
	}
	switch w.Station {
	case StationStitcher:
		var returned, open int
		if err := s.pool.QueryRow(ctx, `
			SELECT (SELECT COUNT(*) FROM rework_logs rl JOIN batch_units u ON u.id = rl.unit_id
			        WHERE u.stitched_by = $1 AND rl.flagged_at >= $2)::int,
			       (SELECT COUNT(*) FROM rework_logs rl JOIN batch_units u ON u.id = rl.unit_id
			        WHERE u.stitched_by = $1 AND rl.fixed_at IS NULL
			          AND ((rl.route = 'stitcher' AND rl.decision IS NULL) OR rl.decision = 'to_stitcher'))::int`,
			id, from).Scan(&returned, &open); err != nil {
			return nil, err
		}
		out.ReworkReturned, out.ReworkOpen = &returned, &open
	case StationPacker:
		var n int
		if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM rework_logs WHERE flagged_by = $1 AND flagged_at >= $2`,
			id, from).Scan(&n); err != nil {
			return nil, err
		}
		out.Flagged = &n
	}
	return out, nil
}
