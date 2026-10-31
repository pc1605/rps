package reference

import (
	"errors"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog/log"

	"github.com/pc1605/rps/apps/backend/internal/factorytime"
	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

// Car item page (U1, audit §4.3): the item, output/quality over a range, and its batches.

type carInfo struct {
	ID                   int     `json:"id"`
	BrandName            string  `json:"brand_name"`
	Name                 string  `json:"name"`
	SizeClass            string  `json:"size_class"`
	PiecesPerSet         int     `json:"pieces_per_set"`
	ProductLineID        *int    `json:"product_line_id,omitempty"`
	LineCode             *string `json:"line_code,omitempty"`
	LineName             *string `json:"line_name,omitempty"`
	Barcode              *string `json:"barcode,omitempty"`
	IsActive             bool    `json:"is_active"`
	ConsumptionGroupID   int     `json:"consumption_group_id"`
	ConsumptionGroupName string  `json:"consumption_group_name"`
}

type carStats struct {
	From         string   `json:"from"`
	To           string   `json:"to"`
	Stitched     int      `json:"stitched"`      // mats stitched in range
	Packed       int      `json:"packed"`        // mats packed in range
	ReworkRounds int      `json:"rework_rounds"` // rounds flagged in range
	ReworkRate   *float64 `json:"rework_rate"`   // rounds / stitched in range × 100
	FirstPass    *float64 `json:"first_pass"`    // packed in range with no rework round / packed in range × 100
	InWIP        int      `json:"in_wip"`        // mats of batches not completed/cancelled (now)
	InStock      int      `json:"in_stock"`      // packed, not dispatched (now)
}

type carBatch struct {
	ID         uuid.UUID `json:"id"`
	BatchCode  string    `json:"batch_code"`
	Quantity   int       `json:"quantity"`
	Phase      string    `json:"current_phase"`
	Status     string    `json:"status"`
	UnitsDone  int       `json:"units_packed"`
	ReworkOpen int       `json:"rework_open"`
	CreatedAt  time.Time `json:"created_at"`
}

type carOverview struct {
	Car           carInfo    `json:"car"`
	Stats         carStats   `json:"stats"`
	ActiveBatches []carBatch `json:"active_batches"`
	RecentDone    []carBatch `json:"recent_completed"` // last 10
}

func pct(n, d int) *float64 {
	if d == 0 {
		return nil
	}
	v := float64(int(float64(n)/float64(d)*1000+0.5)) / 10
	return &v
}

// CarOverview — GET /car-models/:id/overview?from&to (factory days, inclusive; default last 30).
func (h *Handler) CarOverview(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil || id <= 0 {
		return httpx.BadRequest(c, "invalid id")
	}
	today := factorytime.StartOfDay(time.Now())
	from, to := today.AddDate(0, 0, -29), today.AddDate(0, 0, 1)
	if v := c.Query("from"); v != "" {
		if from, err = factorytime.ParseDay(v); err != nil {
			return httpx.BadRequest(c, "from must be YYYY-MM-DD")
		}
	}
	if v := c.Query("to"); v != "" {
		t, err := factorytime.ParseDay(v)
		if err != nil {
			return httpx.BadRequest(c, "to must be YYYY-MM-DD")
		}
		to = t.AddDate(0, 0, 1)
	}
	if !to.After(from) {
		return httpx.BadRequest(c, "'to' must not be before 'from'")
	}
	ctx := c.Context()
	out := carOverview{ActiveBatches: []carBatch{}, RecentDone: []carBatch{}}
	ci := &out.Car
	err = h.svc.pool.QueryRow(ctx, `
		SELECT cm.id, cb.name, cm.name, cm.size_class::text, cm.pieces_per_set, cm.product_line_id, pl.code, pl.name,
		       cm.barcode, cm.is_active, cm.consumption_group_id, g.name
		FROM car_models cm JOIN car_brands cb ON cb.id = cm.brand_id
		LEFT JOIN product_lines pl ON pl.id = cm.product_line_id
		JOIN consumption_groups g ON g.id = cm.consumption_group_id
		WHERE cm.id = $1`, id).Scan(&ci.ID, &ci.BrandName, &ci.Name, &ci.SizeClass, &ci.PiecesPerSet, &ci.ProductLineID,
		&ci.LineCode, &ci.LineName, &ci.Barcode, &ci.IsActive, &ci.ConsumptionGroupID, &ci.ConsumptionGroupName)
	if errors.Is(err, pgx.ErrNoRows) {
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "item not found")
	}
	if err != nil {
		log.Error().Err(err).Msg("car overview")
		return httpx.Internal(c, "failed to load item")
	}

	st := &out.Stats
	st.From = from.Format("2006-01-02")
	st.To = to.AddDate(0, 0, -1).Format("2006-01-02")
	var packedClean int
	if err := h.svc.pool.QueryRow(ctx, `
		WITH u AS (SELECT bu.* FROM batch_units bu JOIN batches b ON b.id = bu.batch_id WHERE b.car_model_id = $1)
		SELECT
		  (SELECT COUNT(*) FROM u WHERE stitched_at >= $2 AND stitched_at < $3)::int,
		  (SELECT COUNT(*) FROM u WHERE packed_at >= $2 AND packed_at < $3)::int,
		  (SELECT COUNT(*) FROM u WHERE packed_at >= $2 AND packed_at < $3
		     AND NOT EXISTS (SELECT 1 FROM rework_logs rl WHERE rl.unit_id = u.id))::int,
		  (SELECT COUNT(*) FROM rework_logs rl JOIN u ON u.id = rl.unit_id WHERE rl.flagged_at >= $2 AND rl.flagged_at < $3)::int,
		  (SELECT COUNT(*) FROM u JOIN batches b ON b.id = u.batch_id WHERE b.status NOT IN ('completed', 'cancelled'))::int,
		  (SELECT COUNT(*) FROM u WHERE status = 'packed')::int`, id, from, to).Scan(
		&st.Stitched, &st.Packed, &packedClean, &st.ReworkRounds, &st.InWIP, &st.InStock); err != nil {
		log.Error().Err(err).Msg("car overview stats")
		return httpx.Internal(c, "failed to load item")
	}
	st.ReworkRate = pct(st.ReworkRounds, st.Stitched)
	st.FirstPass = pct(packedClean, st.Packed)

	load := func(where string, dst *[]carBatch) error {
		rows, err := h.svc.pool.Query(ctx, `
			SELECT b.id, b.batch_code, b.quantity, b.current_phase::text, b.status::text,
			       (SELECT COUNT(*) FROM batch_units u WHERE u.batch_id = b.id AND u.status = 'packed')::int,
			       (SELECT COUNT(*) FROM rework_logs rl WHERE rl.batch_id = b.id AND rl.fixed_at IS NULL
			          AND (rl.decision IS NULL OR rl.decision = 'to_stitcher'))::int,
			       b.created_at
			FROM batches b WHERE b.car_model_id = $1 AND `+where, id)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var b carBatch
			if err := rows.Scan(&b.ID, &b.BatchCode, &b.Quantity, &b.Phase, &b.Status, &b.UnitsDone, &b.ReworkOpen, &b.CreatedAt); err != nil {
				return err
			}
			*dst = append(*dst, b)
		}
		return rows.Err()
	}
	if err := load(`b.status NOT IN ('completed', 'cancelled') ORDER BY b.created_at`, &out.ActiveBatches); err != nil {
		log.Error().Err(err).Msg("car overview batches")
		return httpx.Internal(c, "failed to load item")
	}
	if err := load(`b.status = 'completed' ORDER BY b.updated_at DESC LIMIT 10`, &out.RecentDone); err != nil {
		log.Error().Err(err).Msg("car overview batches")
		return httpx.Internal(c, "failed to load item")
	}
	return httpx.OK(c, out)
}
