package batch

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/pc1605/rps/apps/backend/internal/audit"
)

// Spare stock (U3, D35–D36): mats of cancelled batches with status 'spare'. They stay on the
// cancelled batch until reused on a new batch of the same car item (car_models row) or written off.

type SpareSource struct {
	BatchID   uuid.UUID `json:"batch_id"`
	BatchCode string    `json:"batch_code"`
	Count     int       `json:"count"`
}

type SpareStock struct {
	CarModelID int           `json:"car_model_id"`
	BrandName  string        `json:"brand_name"`
	ModelName  string        `json:"model_name"`
	SizeClass  string        `json:"size_class"`
	LineName   *string       `json:"line_name,omitempty"`
	Barcode    *string       `json:"barcode,omitempty"`
	Stitched   int           `json:"stitched"`
	Unstitched int           `json:"unstitched"`
	OldestAt   time.Time     `json:"oldest_at"` // when the oldest of these batches was cancelled
	Sources    []SpareSource `json:"sources"`
}

// ListSpares — GET /spares[?car_model_id=]: spare mats per car item, most first.
func (s *Service) ListSpares(ctx context.Context, carModelID *int) ([]SpareStock, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT cm.id, cb.name, cm.name, cm.size_class::text, pl.name, cm.barcode,
		       COUNT(*) FILTER (WHERE bu.stitched_at IS NOT NULL)::int,
		       COUNT(*) FILTER (WHERE bu.stitched_at IS NULL)::int,
		       MIN(b.updated_at)
		FROM batch_units bu
		JOIN batches b     ON b.id = bu.batch_id
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		LEFT JOIN product_lines pl ON pl.id = cm.product_line_id
		WHERE bu.status = 'spare' AND ($1::int IS NULL OR cm.id = $1)
		GROUP BY cm.id, cb.name, cm.name, cm.size_class, pl.name, cm.barcode
		ORDER BY COUNT(*) DESC, cb.name, cm.name`, carModelID)
	if err != nil {
		return nil, err
	}
	out := []SpareStock{}
	for rows.Next() {
		var sp SpareStock
		if err := rows.Scan(&sp.CarModelID, &sp.BrandName, &sp.ModelName, &sp.SizeClass, &sp.LineName, &sp.Barcode,
			&sp.Stitched, &sp.Unstitched, &sp.OldestAt); err != nil {
			rows.Close()
			return nil, err
		}
		out = append(out, sp)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// Per-batch counts (small: spares are rare).
	for i := range out {
		srcRows, err := s.pool.Query(ctx, `
			SELECT b.id, b.batch_code, COUNT(*)::int
			FROM batch_units bu JOIN batches b ON b.id = bu.batch_id
			WHERE bu.status = 'spare' AND b.car_model_id = $1
			GROUP BY b.id, b.batch_code, b.updated_at ORDER BY b.updated_at`, out[i].CarModelID)
		if err != nil {
			return nil, err
		}
		out[i].Sources = []SpareSource{}
		for srcRows.Next() {
			var src SpareSource
			if err := srcRows.Scan(&src.BatchID, &src.BatchCode, &src.Count); err != nil {
				srcRows.Close()
				return nil, err
			}
			out[i].Sources = append(out[i].Sources, src)
		}
		srcRows.Close()
		if err := srcRows.Err(); err != nil {
			return nil, err
		}
	}
	return out, nil
}

// SpareWriteOffInput — POST /spares/write-off: write off this many stitched / unstitched spares of
// one car item (oldest first).
type SpareWriteOffInput struct {
	CarModelID int    `json:"car_model_id"`
	Stitched   int    `json:"stitched"`
	Unstitched int    `json:"unstitched"`
	Note       string `json:"note"`
}

// WriteOffSpares marks spare mats defective (written off); audit row lists the unit codes.
func (s *Service) WriteOffSpares(ctx context.Context, in SpareWriteOffInput, actorID uuid.UUID, actorRole, ip string) ([]string, error) {
	if in.CarModelID <= 0 || in.Stitched < 0 || in.Unstitched < 0 || in.Stitched+in.Unstitched == 0 {
		return nil, fmt.Errorf("%w: pick at least one spare mat to write off", ErrInvalidInput)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	ids, codes, err := pickSpares(ctx, tx, in.CarModelID, in.Stitched, in.Unstitched)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE batch_units SET status = 'defective' WHERE id = ANY($1)`, ids); err != nil {
		return nil, err
	}
	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: actorID.String(), ActorRole: actorRole,
		EntityType: "spares", EntityID: fmt.Sprint(in.CarModelID),
		Action: audit.ActionTransition,
		After: map[string]any{"event": "spares_written_off", "car_model_id": in.CarModelID,
			"stitched": in.Stitched, "unstitched": in.Unstitched, "unit_codes": codes, "note": in.Note},
		IP: ip,
	}); err != nil {
		return nil, err
	}
	return codes, tx.Commit(ctx)
}

// pickSpares locks and returns `stitched` stitched + `unstitched` unstitched spares of one car item,
// oldest cancelled batch first. ErrInvalidInput when there aren't enough.
func pickSpares(ctx context.Context, tx pgx.Tx, carModelID, stitched, unstitched int) ([]uuid.UUID, []string, error) {
	var ids []uuid.UUID
	var codes []string
	for _, want := range []struct {
		n        int
		stitched bool
		label    string
	}{{stitched, true, "stitched"}, {unstitched, false, "unstitched"}} {
		if want.n == 0 {
			continue
		}
		rows, err := tx.Query(ctx, `
			SELECT bu.id, bu.unit_code FROM batch_units bu JOIN batches b ON b.id = bu.batch_id
			WHERE bu.status = 'spare' AND b.car_model_id = $1 AND (bu.stitched_at IS NOT NULL) = $2
			ORDER BY b.updated_at, bu.unit_number
			LIMIT $3 FOR UPDATE OF bu`, carModelID, want.stitched, want.n)
		if err != nil {
			return nil, nil, err
		}
		got := 0
		for rows.Next() {
			var id uuid.UUID
			var code string
			if err := rows.Scan(&id, &code); err != nil {
				rows.Close()
				return nil, nil, err
			}
			ids = append(ids, id)
			codes = append(codes, code)
			got++
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, nil, err
		}
		if got < want.n {
			return nil, nil, fmt.Errorf("%w: only %d %s spare %s for this item", ErrInvalidInput, got, want.label, mats(got))
		}
	}
	return ids, codes, nil
}
