package worker

import (
	"context"
	"fmt"
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

// HistoryDay is one worked day on the phone's work history: the count only (no scan times — D40, small payload).
type HistoryDay struct {
	Day  string `json:"day"` // YYYY-MM-DD, factory time
	Mats int    `json:"mats"`
}

// MyHistory is the phone's "My work" month screen (M1, D42): the same per-day counts the admin sees.
type MyHistory struct {
	Station    Station      `json:"station"`
	Unit       string       `json:"unit"`        // "pieces cut" | "mats stitched" | "mats packed"
	Month      string       `json:"month"`       // YYYY-MM, factory time
	Total      int          `json:"total"`       // sum of days
	DaysWorked int          `json:"days_worked"` // days with output
	Days       []HistoryDay `json:"days"`        // days with output only, oldest first
	FirstMonth string       `json:"first_month"` // month of the worker's first output (this month if none)
}

const monthLayout = "2006-01"

// firstOutput: when the worker's first counted output happened (nil = none yet). Same facts as outputSQL.
func (s *Service) firstOutput(ctx context.Context, id uuid.UUID, st Station) (*time.Time, error) {
	q := `SELECT MIN(stitched_at) FROM batch_units WHERE stitched_by = $1`
	switch st {
	case StationCutter:
		q = `SELECT MIN(completed_at) FROM phase_logs WHERE worker_id = $1 AND phase = 'cutting'`
	case StationPacker:
		q = `SELECT MIN(packed_at) FROM batch_units WHERE packed_by = $1`
	}
	var at *time.Time
	if err := s.pool.QueryRow(ctx, q, id).Scan(&at); err != nil {
		return nil, err
	}
	return at, nil
}

// MyHistory — GET /worker/me/history?month=YYYY-MM ("" = the current factory month). The current month
// stops at today; a malformed or future month is ErrInvalidInput. Counts come from days(), like Summary.
func (s *Service) MyHistory(ctx context.Context, id uuid.UUID, month string, now time.Time) (*MyHistory, error) {
	today := factorytime.StartOfDay(now)
	thisMonth := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, today.Location())
	from := thisMonth
	if month != "" {
		var err error
		if from, err = time.ParseInLocation(monthLayout, month, factorytime.Location()); err != nil {
			return nil, fmt.Errorf("%w: month must be YYYY-MM", ErrInvalidInput)
		}
		if from.After(thisMonth) {
			return nil, fmt.Errorf("%w: month is in the future", ErrInvalidInput)
		}
	}
	to := from.AddDate(0, 1, 0)
	if tomorrow := today.AddDate(0, 0, 1); to.After(tomorrow) {
		to = tomorrow
	}
	w, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	_, unit := outputSQL(w.Station)
	days, err := s.days(ctx, id, w.Station, from, to)
	if err != nil {
		return nil, err
	}
	out := &MyHistory{Station: w.Station, Unit: unit, Month: from.Format(monthLayout),
		DaysWorked: len(days), Days: make([]HistoryDay, len(days)), FirstMonth: thisMonth.Format(monthLayout)}
	for i, d := range days {
		out.Days[i] = HistoryDay{Day: d.Day, Mats: d.Mats}
	}
	out.Total, _ = sum(days)
	first, err := s.firstOutput(ctx, id, w.Station)
	if err != nil {
		return nil, err
	}
	if first != nil && first.Before(thisMonth) {
		out.FirstMonth = first.In(factorytime.Location()).Format(monthLayout)
	}
	return out, nil
}
