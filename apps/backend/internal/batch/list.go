package batch

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Batch list (U2): filters, sort and offset pagination — all driven by URL params in the admin.

// Views mirror apps/admin-web/features/batches/views.ts (the sidebar phase tabs).
// A cancelled batch keeps the phase it stopped in, so it is only in the "cancelled" view.
var listViews = map[string]string{
	"to_cut":    `b.current_phase = 'cutting' AND b.status = 'awaiting_assignment'`,
	"cutting":   `b.current_phase = 'cutting' AND b.status NOT IN ('awaiting_assignment', 'cancelled')`,
	"ready":     `b.current_phase = 'stitching' AND b.status = 'awaiting_assignment'`,
	"stitching": `b.current_phase = 'stitching' AND b.status NOT IN ('awaiting_assignment', 'cancelled')`,
	"packing":   `b.current_phase = 'packing' AND b.status <> 'cancelled'`,
	"completed": `b.current_phase = 'completed'`,
	"cancelled": `b.status = 'cancelled'`,
}

// readySinceExpr: how long a batch has waited for the admin to assign it. NULL when not
// awaiting_assignment; falls back to updated_at for a batch with no such event.
//   - Ready to stitch: when cutting last finished (owner, U3: resolving a short cut or clearing an
//     assignment does not restart the wait; a re-cut does, since cutting finishes again).
//   - Needs a cutter (D48): when it last came to cutting — created, sent back to re-cut, or given
//     back by its cutter. Clearing an assignment doesn't restart it either.
const readySinceExpr = `CASE WHEN b.status = 'awaiting_assignment' THEN COALESCE(
	  CASE WHEN b.current_phase = 'cutting'
	    THEN (SELECT MAX(e.at) FROM batch_events e WHERE e.batch_id = b.id AND e.to_phase = 'cutting'
	          AND e.kind IN ('created', 'short_resolved', 'claim_released'))
	    ELSE (SELECT MAX(e.at) FROM batch_events e WHERE e.batch_id = b.id AND e.kind = 'cut_completed') END,
	  b.updated_at) END`

// activeWorkersExpr: who's working on the batch right now — names of the open phase logs at the
// current phase ("Surya, Mahesh"), NULL when nobody. Used by the list and the detail (cancel warning).
const activeWorkersExpr = `(SELECT string_agg(wk.name, ', ' ORDER BY plg.started_at)
	  FROM phase_logs plg JOIN workers wk ON wk.id = plg.worker_id
	  WHERE plg.batch_id = b.id AND plg.phase = b.current_phase AND plg.completed_at IS NULL)`

// reusedInExpr: for a cancelled batch, where its spares went — JSON [{batch_id, batch_code, count}] of
// the batches whose units have reused_from = this batch; NULL otherwise (P1: "All 5 mats reused in …").
const reusedInExpr = `CASE WHEN b.status = 'cancelled' THEN (
	  SELECT json_agg(json_build_object('batch_id', nb.id, 'batch_code', nb.batch_code, 'count', r.n) ORDER BY nb.created_at)
	  FROM (SELECT bu.batch_id, COUNT(*)::int AS n FROM batch_units bu WHERE bu.reused_from = b.id GROUP BY bu.batch_id) r
	  JOIN batches nb ON nb.id = r.batch_id) END`

// Sortable columns (whitelist). Every sort ends with created_at, id for a stable order.
var listSorts = map[string]string{
	// ascending = longest waiting first; batches not waiting sort last either way (NULLS LAST)
	"waiting":  readySinceExpr,
	"created":  `b.created_at`,
	"code":     `b.batch_code`,
	"quantity": `b.quantity`,
	"phase": `CASE b.current_phase WHEN 'cutting' THEN
	            CASE WHEN b.status = 'awaiting_assignment' THEN 0 ELSE 1 END WHEN 'stitching' THEN
	            CASE WHEN b.status = 'awaiting_assignment' THEN 2 ELSE 3 END WHEN 'packing' THEN 4 ELSE 5 END`,
	"car": `lower(cb.name || ' ' || cm.name)`,
}

type ListFilter struct {
	View          string     // "" = all
	Q             string     // batch code, car (brand + model), product line name, exact barcode
	CarModelID    *int       //
	ProductLineID *int       //
	From, To      *time.Time // created_at in [From, To)
	HasRework     *bool      // open rework rounds
	Short         *bool      // short cut awaiting a decision
	Sort          string     // key of listSorts; default "created"
	Desc          bool       //
	Page          int        // 1-based
	Limit         int        // 0 = no limit (internal use only)
}

type ListPage struct {
	Items []Batch `json:"items"`
	Total int     `json:"total"`
	Page  int     `json:"page"`
	Limit int     `json:"limit"`
}

// ValidateListFilter checks enum-like fields (the handler clamps page/limit).
func ValidateListFilter(f ListFilter) error {
	if f.View != "" {
		if _, ok := listViews[f.View]; !ok {
			return fmt.Errorf("%w: view must be one of to_cut, cutting, ready, stitching, packing, completed, cancelled", ErrInvalidInput)
		}
	}
	if f.Sort != "" {
		if _, ok := listSorts[f.Sort]; !ok {
			return fmt.Errorf("%w: sort must be one of created, code, quantity, phase, car, waiting", ErrInvalidInput)
		}
	}
	return nil
}

const listSelect = `
	SELECT b.id, b.batch_code, b.car_model_id,
	       cb.name, cm.name, cm.size_class::text, pl.code, pl.name, cm.barcode,
	       b.roll_id, rm.lot_code,
	       b.quantity, b.current_phase, b.status, COALESCE(b.notes,''),
	       b.rework_count, b.created_by, u.name,
	       b.version, b.created_at, b.updated_at, b.cut_qty, b.parent_batch_id, pb.batch_code, b.short_reason, b.stickers_printed_at,
	       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id),
	       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id AND bu.status = 'packed'),
	       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id AND bu.stitched_at IS NOT NULL),
	       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id AND bu.status = 'defective'),
	       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id AND bu.prestitched),
	       (SELECT COUNT(*) FROM rework_logs rl WHERE rl.batch_id = b.id AND rl.fixed_at IS NULL AND (rl.decision IS NULL OR rl.decision = 'to_stitcher')),
	       ` + activeWorkersExpr + `,
	       ` + readySinceExpr + `,
	       ` + reusedInExpr

const listFrom = `
	FROM batches b
	JOIN car_models cm ON cm.id = b.car_model_id
	JOIN car_brands cb ON cb.id = cm.brand_id
	LEFT JOIN product_lines pl ON pl.id = cm.product_line_id
	LEFT JOIN batches pb ON pb.id = b.parent_batch_id
	JOIN users u       ON u.id = b.created_by
	LEFT JOIN material_lots rm ON rm.id = b.roll_id`

// likeEscape makes user text safe inside ILIKE '%…%'.
func likeEscape(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// ListPage returns one page of batches matching the filter, plus the total match count.
func (s *Service) ListPage(ctx context.Context, f ListFilter) (*ListPage, error) {
	if err := ValidateListFilter(f); err != nil {
		return nil, err
	}
	var where []string
	var args []any
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	if f.View != "" {
		where = append(where, listViews[f.View])
	}
	if q := strings.TrimSpace(f.Q); q != "" {
		like := arg("%" + likeEscape(q) + "%")
		exact := arg(q)
		where = append(where, fmt.Sprintf(`(b.batch_code ILIKE %[1]s OR (cb.name || ' ' || cm.name) ILIKE %[1]s
			OR pl.name ILIKE %[1]s OR cm.barcode = %[2]s)`, like, exact))
	}
	if f.CarModelID != nil {
		where = append(where, "b.car_model_id = "+arg(*f.CarModelID))
	}
	if f.ProductLineID != nil {
		where = append(where, "cm.product_line_id = "+arg(*f.ProductLineID))
	}
	if f.From != nil {
		where = append(where, "b.created_at >= "+arg(*f.From))
	}
	if f.To != nil {
		where = append(where, "b.created_at < "+arg(*f.To))
	}
	if f.HasRework != nil {
		cond := `EXISTS (SELECT 1 FROM rework_logs rl WHERE rl.batch_id = b.id AND rl.fixed_at IS NULL
		          AND (rl.decision IS NULL OR rl.decision = 'to_stitcher'))`
		if !*f.HasRework {
			cond = "NOT " + cond
		}
		where = append(where, cond)
	}
	if f.Short != nil {
		cond := `(b.current_phase = 'stitching' AND b.status = 'awaiting_assignment' AND b.cut_qty < b.quantity)`
		if !*f.Short {
			cond = "NOT " + cond
		}
		where = append(where, cond)
	}
	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}

	out := &ListPage{Items: []Batch{}, Page: f.Page, Limit: f.Limit}
	if err := s.pool.QueryRow(ctx, "SELECT COUNT(*)"+listFrom+whereSQL, args...).Scan(&out.Total); err != nil {
		return nil, fmt.Errorf("count batches: %w", err)
	}

	sortKey := f.Sort
	if sortKey == "" {
		sortKey = "created"
	}
	dir := "ASC"
	if f.Desc {
		dir = "DESC"
	}
	order := fmt.Sprintf(" ORDER BY %s %s NULLS LAST, b.created_at DESC, b.id", listSorts[sortKey], dir)
	page := ""
	if f.Limit > 0 {
		if f.Page < 1 {
			f.Page, out.Page = 1, 1
		}
		page = fmt.Sprintf(" LIMIT %s OFFSET %s", arg(f.Limit), arg((f.Page-1)*f.Limit))
	}

	rows, err := s.pool.Query(ctx, listSelect+listFrom+whereSQL+order+page, args...)
	if err != nil {
		return nil, fmt.Errorf("list batches: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var b Batch
		if err := rows.Scan(
			&b.ID, &b.BatchCode, &b.CarModelID,
			&b.BrandName, &b.ModelName, &b.SizeClass, &b.LineCode, &b.LineName, &b.Barcode,
			&b.RollID, &b.RollCode,
			&b.Quantity, &b.CurrentPhase, &b.Status, &b.Notes,
			&b.ReworkCount, &b.CreatedBy, &b.CreatedByName,
			&b.Version, &b.CreatedAt, &b.UpdatedAt,
			&b.CutQty, &b.ParentBatchID, &b.ParentBatchCode, &b.ShortReason, &b.StickersPrintedAt,
			&b.UnitsTotal, &b.UnitsPacked, &b.UnitsStitched, &b.UnitsWrittenOff, &b.UnitsPrestitched, &b.ReworkOpen,
			&b.ActiveWorkers, &b.ReadySince, &b.ReusedIn,
		); err != nil {
			return nil, err
		}
		out.Items = append(out.Items, b)
	}
	return out, rows.Err()
}
