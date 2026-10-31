package worker

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/pc1605/rps/apps/backend/internal/audit"
	"github.com/pc1605/rps/apps/backend/internal/factorytime"
)

// Worker page (U1, audit §4.1): profile + "now", output summary, work history, edit, PIN reset.

var ErrWorkerBusy = errors.New("worker has open work")

// ───── now ─────

type OpenClaim struct {
	BatchID   uuid.UUID `json:"batch_id"`
	BatchCode string    `json:"batch_code"`
	CarName   string    `json:"car_name"`
	Phase     string    `json:"phase"`
	StartedAt time.Time `json:"started_at"`
	MyDone    int       `json:"my_done"`
	TargetQty *int      `json:"target_qty,omitempty"`
}

type AssignedWork struct {
	BatchID   uuid.UUID `json:"batch_id"`
	BatchCode string    `json:"batch_code"`
	CarName   string    `json:"car_name"`
	Phase     string    `json:"phase"`
	TargetQty *int      `json:"target_qty,omitempty"`
	MyDone    int       `json:"my_done"`
}

type OpenRework struct {
	ID               uuid.UUID `json:"id"`
	UnitCode         string    `json:"unit_code"`
	BatchID          uuid.UUID `json:"batch_id"`
	BatchCode        string    `json:"batch_code"`
	Round            int       `json:"round"`
	Reasons          []string  `json:"reasons"`
	FlaggedAt        time.Time `json:"flagged_at"`
	AwaitingDecision bool      `json:"awaiting_decision"` // routed to admin, no decision yet
}

type WorkerDetail struct {
	Worker
	OpenClaims []OpenClaim    `json:"open_claims"`
	Assigned   []AssignedWork `json:"assigned"` // assigned at the batch's current phase, not joined
	OpenRework []OpenRework   `json:"open_rework"`
}

const carName = `cb.name || ' ' || cm.name || COALESCE(' · ' || pl.name, '')`

// Detail returns the profile plus what the worker is doing right now.
func (s *Service) Detail(ctx context.Context, id uuid.UUID) (*WorkerDetail, error) {
	w, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	d := &WorkerDetail{Worker: *w, OpenClaims: []OpenClaim{}, Assigned: []AssignedWork{}, OpenRework: []OpenRework{}}

	rows, err := s.pool.Query(ctx, `
		SELECT b.id, b.batch_code, `+carName+`, l.phase::text, l.started_at,
		       CASE l.phase WHEN 'cutting' THEN 0
		         WHEN 'stitching' THEN (SELECT COUNT(*) FROM batch_units u WHERE u.batch_id = b.id AND u.stitched_by = $1)
		         ELSE (SELECT COUNT(*) FROM batch_units u WHERE u.batch_id = b.id AND u.packed_by = $1) END,
		       (SELECT a.target_qty FROM batch_assignments a WHERE a.batch_id = b.id AND a.phase = l.phase AND a.worker_id = $1)
		FROM phase_logs l
		JOIN batches b ON b.id = l.batch_id
		JOIN car_models cm ON cm.id = b.car_model_id JOIN car_brands cb ON cb.id = cm.brand_id
		LEFT JOIN product_lines pl ON pl.id = cm.product_line_id
		WHERE l.worker_id = $1 AND l.completed_at IS NULL
		ORDER BY l.started_at`, id)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var c OpenClaim
		if err := rows.Scan(&c.BatchID, &c.BatchCode, &c.CarName, &c.Phase, &c.StartedAt, &c.MyDone, &c.TargetQty); err != nil {
			rows.Close()
			return nil, err
		}
		d.OpenClaims = append(d.OpenClaims, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.pool.Query(ctx, `
		SELECT b.id, b.batch_code, `+carName+`, a.phase::text, a.target_qty,
		       CASE a.phase WHEN 'stitching' THEN (SELECT COUNT(*) FROM batch_units u WHERE u.batch_id = b.id AND u.stitched_by = $1)
		         WHEN 'packing' THEN (SELECT COUNT(*) FROM batch_units u WHERE u.batch_id = b.id AND u.packed_by = $1) ELSE 0 END
		FROM batch_assignments a
		JOIN batches b ON b.id = a.batch_id
		JOIN car_models cm ON cm.id = b.car_model_id JOIN car_brands cb ON cb.id = cm.brand_id
		LEFT JOIN product_lines pl ON pl.id = cm.product_line_id
		WHERE a.worker_id = $1 AND b.current_phase = a.phase AND b.status IN ('pending', 'in_progress')
		  AND NOT EXISTS (SELECT 1 FROM phase_logs l WHERE l.batch_id = b.id AND l.phase = a.phase
		                  AND l.worker_id = $1 AND l.completed_at IS NULL)
		ORDER BY b.created_at`, id)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var a AssignedWork
		if err := rows.Scan(&a.BatchID, &a.BatchCode, &a.CarName, &a.Phase, &a.TargetQty, &a.MyDone); err != nil {
			rows.Close()
			return nil, err
		}
		d.Assigned = append(d.Assigned, a)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.pool.Query(ctx, `
		SELECT rl.id, u.unit_code, b.id, b.batch_code, rl.round, rl.reasons, rl.flagged_at,
		       (rl.route = 'admin' AND rl.decision IS NULL)
		FROM rework_logs rl
		JOIN batch_units u ON u.id = rl.unit_id
		JOIN batches b ON b.id = rl.batch_id
		WHERE u.stitched_by = $1 AND rl.fixed_at IS NULL AND (rl.decision IS NULL OR rl.decision = 'to_stitcher')
		ORDER BY rl.flagged_at`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var r OpenRework
		if err := rows.Scan(&r.ID, &r.UnitCode, &r.BatchID, &r.BatchCode, &r.Round, &r.Reasons, &r.FlaggedAt, &r.AwaitingDecision); err != nil {
			return nil, err
		}
		d.OpenRework = append(d.OpenRework, r)
	}
	return d, rows.Err()
}

// ───── output summary ─────

type DayOutput struct {
	Day           string     `json:"day"` // YYYY-MM-DD, factory time
	Mats          int        `json:"mats"`
	FirstAt       *time.Time `json:"first_at,omitempty"`
	LastAt        *time.Time `json:"last_at,omitempty"`
	ActiveSeconds int        `json:"active_seconds"` // stitch/pack: first→last scan; cutting: Σ(complete − start)
}

type ReworkCaused struct {
	Rounds   int            `json:"rounds"`    // rounds flagged in range on mats this stitcher stitched
	RatePct  *float64       `json:"rate_pct"`  // rounds / mats stitched in range × 100
	ByReason map[string]int `json:"by_reason"` // reason → rounds
}

type ReworkFixed struct {
	Count                int  `json:"count"`
	MedianTurnaroundSecs *int `json:"median_turnaround_secs,omitempty"` // fixed_at − (decided_at or flagged_at)
}

type Summary struct {
	WorkerID     uuid.UUID     `json:"worker_id"`
	Station      Station       `json:"station"`
	From         string        `json:"from"`
	To           string        `json:"to"`
	Unit         string        `json:"unit"` // "pieces cut" | "mats stitched" | "mats packed"
	Total        int           `json:"total"`
	Today        int           `json:"today"`
	Last7Days    int           `json:"last_7_days"`
	MatsPerHour  *float64      `json:"mats_per_hour,omitempty"`
	Days         []DayOutput   `json:"days"`
	ReworkCaused *ReworkCaused `json:"rework_caused,omitempty"` // stitchers
	ReworkFixed  *ReworkFixed  `json:"rework_fixed,omitempty"`  // stitchers
	Flagged      *int          `json:"flagged,omitempty"`       // packers: rounds they flagged
}

// outputSQL: one row per (factory day) for the station's output facts in [$2, $3).
func outputSQL(st Station) (string, string) {
	switch st {
	case StationCutter:
		return `
			SELECT (l.completed_at AT TIME ZONE $4)::date::text, COALESCE(SUM(l.quantity_completed), 0)::int,
			       MIN(l.started_at), MAX(l.completed_at), COALESCE(SUM(EXTRACT(EPOCH FROM l.completed_at - l.started_at)), 0)::int
			FROM phase_logs l
			WHERE l.worker_id = $1 AND l.phase = 'cutting' AND l.completed_at >= $2 AND l.completed_at < $3
			GROUP BY 1 ORDER BY 1`, "pieces cut"
	case StationPacker:
		return `
			SELECT (u.packed_at AT TIME ZONE $4)::date::text, COUNT(*)::int, MIN(u.packed_at), MAX(u.packed_at),
			       EXTRACT(EPOCH FROM MAX(u.packed_at) - MIN(u.packed_at))::int
			FROM batch_units u WHERE u.packed_by = $1 AND u.packed_at >= $2 AND u.packed_at < $3
			GROUP BY 1 ORDER BY 1`, "mats packed"
	default:
		return `
			SELECT (u.stitched_at AT TIME ZONE $4)::date::text, COUNT(*)::int, MIN(u.stitched_at), MAX(u.stitched_at),
			       EXTRACT(EPOCH FROM MAX(u.stitched_at) - MIN(u.stitched_at))::int
			FROM batch_units u WHERE u.stitched_by = $1 AND u.stitched_at >= $2 AND u.stitched_at < $3
			GROUP BY 1 ORDER BY 1`, "mats stitched"
	}
}

func (s *Service) days(ctx context.Context, id uuid.UUID, st Station, from, to time.Time) ([]DayOutput, error) {
	q, _ := outputSQL(st)
	rows, err := s.pool.Query(ctx, q, id, from, to, factorytime.Name())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []DayOutput{}
	for rows.Next() {
		var d DayOutput
		if err := rows.Scan(&d.Day, &d.Mats, &d.FirstAt, &d.LastAt, &d.ActiveSeconds); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func sum(ds []DayOutput) (mats, secs int) {
	for _, d := range ds {
		mats += d.Mats
		secs += d.ActiveSeconds
	}
	return
}

// Summary: output in [from, to) (factory days) plus today / last 7 days, and rework figures.
func (s *Service) Summary(ctx context.Context, id uuid.UUID, from, to time.Time) (*Summary, error) {
	w, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	_, unit := outputSQL(w.Station)
	out := &Summary{WorkerID: id, Station: w.Station, Unit: unit,
		From: from.In(factorytime.Location()).Format("2006-01-02"),
		To:   to.In(factorytime.Location()).AddDate(0, 0, -1).Format("2006-01-02")}

	if out.Days, err = s.days(ctx, id, w.Station, from, to); err != nil {
		return nil, err
	}
	total, secs := sum(out.Days)
	out.Total = total
	if secs > 0 && total > 0 {
		r := float64(int(float64(total)/(float64(secs)/3600)*10+0.5)) / 10
		out.MatsPerHour = &r
	}
	today := factorytime.StartOfDay(time.Now())
	tomorrow := today.AddDate(0, 0, 1)
	recent, err := s.days(ctx, id, w.Station, today.AddDate(0, 0, -6), tomorrow)
	if err != nil {
		return nil, err
	}
	out.Last7Days, _ = sum(recent)
	if n := len(recent); n > 0 && recent[n-1].Day == today.Format("2006-01-02") {
		out.Today = recent[n-1].Mats
	}

	switch w.Station {
	case StationStitcher:
		rc := &ReworkCaused{ByReason: map[string]int{}}
		rows, err := s.pool.Query(ctx, `
			SELECT r.reason, COUNT(*)::int FROM rework_logs rl
			JOIN batch_units u ON u.id = rl.unit_id, unnest(rl.reasons) AS r(reason)
			WHERE u.stitched_by = $1 AND rl.flagged_at >= $2 AND rl.flagged_at < $3
			GROUP BY 1`, id, from, to)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var reason string
			var n int
			if err := rows.Scan(&reason, &n); err != nil {
				rows.Close()
				return nil, err
			}
			rc.ByReason[reason] = n
		}
		rows.Close()
		if err := s.pool.QueryRow(ctx, `
			SELECT COUNT(*)::int FROM rework_logs rl JOIN batch_units u ON u.id = rl.unit_id
			WHERE u.stitched_by = $1 AND rl.flagged_at >= $2 AND rl.flagged_at < $3`, id, from, to).Scan(&rc.Rounds); err != nil {
			return nil, err
		}
		if total > 0 {
			r := float64(int(float64(rc.Rounds)/float64(total)*1000+0.5)) / 10
			rc.RatePct = &r
		}
		out.ReworkCaused = rc

		rf := &ReworkFixed{}
		if err := s.pool.QueryRow(ctx, `
			SELECT COUNT(*)::int,
			       (percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM rl.fixed_at - COALESCE(rl.decided_at, rl.flagged_at)))) ::int
			FROM rework_logs rl WHERE rl.fixed_by = $1 AND rl.fixed_at >= $2 AND rl.fixed_at < $3`,
			id, from, to).Scan(&rf.Count, &rf.MedianTurnaroundSecs); err != nil {
			return nil, err
		}
		out.ReworkFixed = rf
	case StationPacker:
		var n int
		if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM rework_logs WHERE flagged_by = $1 AND flagged_at >= $2 AND flagged_at < $3`,
			id, from, to).Scan(&n); err != nil {
			return nil, err
		}
		out.Flagged = &n
	}
	return out, nil
}

// ───── work history ─────

type HistoryRow struct {
	PhaseLogID   uuid.UUID  `json:"phase_log_id"`
	BatchID      uuid.UUID  `json:"batch_id"`
	BatchCode    string     `json:"batch_code"`
	CarModelID   int        `json:"car_model_id"`
	CarName      string     `json:"car_name"`
	Phase        string     `json:"phase"`
	StartedAt    time.Time  `json:"started_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	Mats         int        `json:"mats"` // cutting: pieces reported; stitching/packing: mats scanned by this worker
	TargetQty    *int       `json:"target_qty,omitempty"`
	FirstScanAt  *time.Time `json:"first_scan_at,omitempty"`
	LastScanAt   *time.Time `json:"last_scan_at,omitempty"`
	ReworkCaused int        `json:"rework_caused"` // stitching: rework rounds on this worker's mats in the batch
}

type HistoryPage struct {
	Items      []HistoryRow `json:"items"`
	NextCursor *string      `json:"next_cursor,omitempty"`
}

func encodeCursor(at time.Time, id uuid.UUID) string {
	return base64.RawURLEncoding.EncodeToString([]byte(at.UTC().Format(time.RFC3339Nano) + "|" + id.String()))
}

func decodeCursor(c string) (*time.Time, *uuid.UUID, error) {
	b, err := base64.RawURLEncoding.DecodeString(c)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: bad cursor", ErrInvalidInput)
	}
	ts, ids, ok := strings.Cut(string(b), "|")
	at, err1 := time.Parse(time.RFC3339Nano, ts)
	id, err2 := uuid.Parse(ids)
	if !ok || err1 != nil || err2 != nil {
		return nil, nil, fmt.Errorf("%w: bad cursor", ErrInvalidInput)
	}
	return &at, &id, nil
}

// History: the worker's phase participations, newest first, keyset-paginated.
func (s *Service) History(ctx context.Context, id uuid.UUID, limit int, cursor string) (*HistoryPage, error) {
	if _, err := s.GetByID(ctx, id); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	var cAt *time.Time
	var cID *uuid.UUID
	if cursor != "" {
		var err error
		if cAt, cID, err = decodeCursor(cursor); err != nil {
			return nil, err
		}
	}
	rows, err := s.pool.Query(ctx, `
		SELECT l.id, b.id, b.batch_code, cm.id, `+carName+`, l.phase::text, l.started_at, l.completed_at,
		       CASE l.phase WHEN 'cutting' THEN COALESCE(l.quantity_completed, 0)
		         WHEN 'stitching' THEN (SELECT COUNT(*) FROM batch_units u WHERE u.batch_id = b.id AND u.stitched_by = $1)
		         ELSE (SELECT COUNT(*) FROM batch_units u WHERE u.batch_id = b.id AND u.packed_by = $1) END::int,
		       (SELECT a.target_qty FROM batch_assignments a WHERE a.batch_id = b.id AND a.phase = l.phase AND a.worker_id = $1),
		       CASE l.phase WHEN 'stitching' THEN (SELECT MIN(u.stitched_at) FROM batch_units u WHERE u.batch_id = b.id AND u.stitched_by = $1)
		         WHEN 'packing' THEN (SELECT MIN(u.packed_at) FROM batch_units u WHERE u.batch_id = b.id AND u.packed_by = $1) END,
		       CASE l.phase WHEN 'stitching' THEN (SELECT MAX(u.stitched_at) FROM batch_units u WHERE u.batch_id = b.id AND u.stitched_by = $1)
		         WHEN 'packing' THEN (SELECT MAX(u.packed_at) FROM batch_units u WHERE u.batch_id = b.id AND u.packed_by = $1) END,
		       CASE l.phase WHEN 'stitching' THEN (SELECT COUNT(*) FROM rework_logs rl JOIN batch_units u ON u.id = rl.unit_id
		                                             WHERE rl.batch_id = b.id AND u.stitched_by = $1) ELSE 0 END::int
		FROM phase_logs l
		JOIN batches b ON b.id = l.batch_id
		JOIN car_models cm ON cm.id = b.car_model_id JOIN car_brands cb ON cb.id = cm.brand_id
		LEFT JOIN product_lines pl ON pl.id = cm.product_line_id
		WHERE l.worker_id = $1 AND ($2::timestamptz IS NULL OR (l.started_at, l.id) < ($2, $3::uuid))
		ORDER BY l.started_at DESC, l.id DESC
		LIMIT $4`, id, cAt, cID, limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	page := &HistoryPage{Items: []HistoryRow{}}
	for rows.Next() {
		var h HistoryRow
		if err := rows.Scan(&h.PhaseLogID, &h.BatchID, &h.BatchCode, &h.CarModelID, &h.CarName, &h.Phase, &h.StartedAt,
			&h.CompletedAt, &h.Mats, &h.TargetQty, &h.FirstScanAt, &h.LastScanAt, &h.ReworkCaused); err != nil {
			return nil, err
		}
		page.Items = append(page.Items, h)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(page.Items) > limit {
		page.Items = page.Items[:limit]
		last := page.Items[limit-1]
		c := encodeCursor(last.StartedAt, last.PhaseLogID)
		page.NextCursor = &c
	}
	return page, nil
}

// ───── edit / deactivate / PIN ─────

type UpdateInput struct {
	Name     *string `json:"name"`
	Phone    *string `json:"phone"` // "" clears
	Station  *string `json:"station"`
	IsActive *bool   `json:"is_active"`
}

// openWork counts open claims and unfinished assignments (batch still at that phase).
func openWork(ctx context.Context, tx pgx.Tx, id uuid.UUID) (claims, assigned int, err error) {
	err = tx.QueryRow(ctx, `
		SELECT (SELECT COUNT(*) FROM phase_logs WHERE worker_id = $1 AND completed_at IS NULL)::int,
		       (SELECT COUNT(*) FROM batch_assignments a JOIN batches b ON b.id = a.batch_id
		         WHERE a.worker_id = $1 AND b.current_phase = a.phase AND b.status IN ('pending','in_progress','awaiting_assignment')
		           AND (a.target_qty IS NULL OR a.target_qty > (SELECT COUNT(*) FROM batch_units u WHERE u.batch_id = b.id
		                 AND ((a.phase = 'stitching' AND u.stitched_by = $1) OR (a.phase = 'packing' AND u.packed_by = $1)))))::int`,
		id).Scan(&claims, &assigned)
	return
}

// Update edits a worker. Changing station or deactivating is refused (ErrWorkerBusy) while the worker
// has open claims or unfinished assignments — reassign first.
func (s *Service) Update(ctx context.Context, id uuid.UUID, in UpdateInput, actorID uuid.UUID, actorRole, ip string) (*Worker, error) {
	if in.Name != nil {
		n := strings.TrimSpace(*in.Name)
		if n == "" {
			return nil, fmt.Errorf("%w: name can't be empty", ErrInvalidInput)
		}
		in.Name = &n
	}
	if in.Station != nil {
		switch Station(*in.Station) {
		case StationCutter, StationStitcher, StationPacker:
		default:
			return nil, fmt.Errorf("%w: invalid station", ErrInvalidInput)
		}
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var before Worker
	err = tx.QueryRow(ctx, `SELECT id, name, COALESCE(phone,''), station, is_active, last_login_at, created_at
		FROM workers WHERE id = $1 FOR UPDATE`, id).Scan(&before.ID, &before.Name, &before.Phone, &before.Station,
		&before.IsActive, &before.LastLoginAt, &before.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	stationChange := in.Station != nil && Station(*in.Station) != before.Station
	deactivate := in.IsActive != nil && !*in.IsActive && before.IsActive
	if stationChange || deactivate {
		claims, assigned, err := openWork(ctx, tx, id)
		if err != nil {
			return nil, err
		}
		if claims > 0 || assigned > 0 {
			return nil, fmt.Errorf("%w: %d open claim(s), %d unfinished assignment(s) — reassign them first", ErrWorkerBusy, claims, assigned)
		}
	}
	var after Worker
	if err := tx.QueryRow(ctx, `
		UPDATE workers SET name = COALESCE($2, name),
		  phone = CASE WHEN $3::text IS NULL THEN phone ELSE NULLIF($3, '') END,
		  station = COALESCE($4::worker_station, station), is_active = COALESCE($5, is_active)
		WHERE id = $1
		RETURNING id, name, COALESCE(phone,''), station, is_active, last_login_at, created_at`,
		id, in.Name, in.Phone, in.Station, in.IsActive).Scan(&after.ID, &after.Name, &after.Phone, &after.Station,
		&after.IsActive, &after.LastLoginAt, &after.CreatedAt); err != nil {
		return nil, err
	}
	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: actorID.String(), ActorRole: actorRole, EntityType: "worker", EntityID: id.String(),
		Action: audit.ActionUpdate, Before: before, After: after, IP: ip,
	}); err != nil {
		return nil, err
	}
	return &after, tx.Commit(ctx)
}

// ResetPIN sets a new PIN (given, or a random 4-digit one). The PIN is returned to the caller
// once and never logged or audited.
func (s *Service) ResetPIN(ctx context.Context, id uuid.UUID, pin string, actorID uuid.UUID, actorRole, ip string) (string, error) {
	if pin == "" {
		n, err := rand.Int(rand.Reader, big.NewInt(10000))
		if err != nil {
			return "", err
		}
		pin = fmt.Sprintf("%04d", n.Int64())
	}
	if !pinRegex.MatchString(pin) {
		return "", fmt.Errorf("%w: pin must be 4 digits", ErrInvalidInput)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	ct, err := tx.Exec(ctx, `UPDATE workers SET pin_hash = $2 WHERE id = $1`, id, string(hash))
	if err != nil {
		return "", err
	}
	if ct.RowsAffected() == 0 {
		return "", ErrNotFound
	}
	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: actorID.String(), ActorRole: actorRole, EntityType: "worker", EntityID: id.String(),
		Action: audit.ActionUpdate, After: map[string]any{"event": "pin_reset"}, IP: ip,
	}); err != nil {
		return "", err
	}
	return pin, tx.Commit(ctx)
}
