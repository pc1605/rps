package batch

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// UnitJourney is everything about one mat (U1 unit page): its batch, who cut / stitched / packed it,
// and every rework round with photos.
type UnitJourney struct {
	Unit    Unit            `json:"unit"`
	Batch   Batch           `json:"batch"`
	Cutting []PhaseLogEntry `json:"cutting"` // the batch's cutting completions (a mat isn't scanned at cutting)
}

func (s *Service) UnitJourney(ctx context.Context, code string) (*UnitJourney, error) {
	var batchID uuid.UUID
	err := s.pool.QueryRow(ctx, `SELECT batch_id FROM batch_units WHERE unit_code = $1`, code).Scan(&batchID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUnitNotFound
	}
	if err != nil {
		return nil, err
	}
	d, err := s.Get(ctx, batchID)
	if err != nil {
		return nil, err
	}
	out := &UnitJourney{Batch: d.Batch, Cutting: []PhaseLogEntry{}}
	for _, u := range d.Units {
		if u.UnitCode == code {
			out.Unit = u
		}
	}
	for _, e := range d.Timeline {
		if e.Phase == PhaseCutting {
			out.Cutting = append(out.Cutting, e)
		}
	}
	return out, nil
}
