package materials

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ───────────────────────── dry run ─────────────────────────

type ResolveResult struct {
	CarModelID int        `json:"car_model_id"`
	Quantity   int        `json:"quantity"`
	LotID      *uuid.UUID `json:"lot_id,omitempty"`
	Lines      []PlanLine `json:"lines"`
	Notes      []string   `json:"notes"`
}

// Resolve runs the engine's planner without writing: what a cut of `quantity` mats would draw now.
func (s *Service) Resolve(ctx context.Context, carID, quantity int, lotID *uuid.UUID) (*ResolveResult, error) {
	if carID <= 0 {
		return nil, invalid("car_model_id is required")
	}
	if quantity <= 0 {
		return nil, invalid("quantity must be > 0")
	}
	if err := s.carExists(ctx, s.pool, carID); err != nil {
		return nil, err
	}
	plan, err := BuildPlan(ctx, s.pool, PlanInput{CarModelID: carID, RollID: lotID, Mats: quantity})
	if err != nil {
		return nil, err
	}
	return &ResolveResult{CarModelID: carID, Quantity: quantity, LotID: lotID, Lines: plan.Lines, Notes: plan.Notes}, nil
}

// ───────────────────────── batch materials ─────────────────────────

type PlanRow struct {
	ID             uuid.UUID  `json:"id"`
	PhaseLogID     *uuid.UUID `json:"phase_log_id,omitempty"`
	MaterialTypeID int        `json:"material_type_id"`
	TypeCode       string     `json:"type_code"`
	TypeName       string     `json:"type_name"`
	Unit           string     `json:"unit"`
	VariantID      *int       `json:"variant_id,omitempty"`
	VariantName    *string    `json:"variant_name,omitempty"`
	Source         string     `json:"source"`
	QtyPerMat      *Milli     `json:"qty_per_mat,omitempty"`
	Mats           int        `json:"mats"`
	PlannedQty     *Milli     `json:"planned_qty,omitempty"`
	Note           *string    `json:"note,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type Completion struct {
	PhaseLogID  *uuid.UUID `json:"phase_log_id,omitempty"` // nil = rows not linked to a completion
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	WorkerName  *string    `json:"worker_name,omitempty"`
	Mats        *int       `json:"mats,omitempty"`
	Plan        []PlanRow  `json:"plan"`
	Movements   []Movement `json:"movements"`
}

type BatchMaterials struct {
	BatchID     uuid.UUID    `json:"batch_id"`
	BatchCode   string       `json:"batch_code"`
	Completions []Completion `json:"completions"`
}

// BatchMaterials: plan rows + consume/shortfall movements, grouped by cutting completion (oldest first).
func (s *Service) BatchMaterials(ctx context.Context, batchID uuid.UUID) (*BatchMaterials, error) {
	out := &BatchMaterials{BatchID: batchID, Completions: []Completion{}}
	err := s.pool.QueryRow(ctx, `SELECT batch_code FROM batches WHERE id = $1`, batchID).Scan(&out.BatchCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("%w: batch %s", ErrNotFound, batchID)
	}
	if err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT pl.id, pl.completed_at, w.name, pl.quantity_completed
		FROM phase_logs pl JOIN workers w ON w.id = pl.worker_id
		WHERE pl.batch_id = $1 AND pl.phase = 'cutting' AND pl.completed_at IS NOT NULL
		ORDER BY pl.started_at, pl.id`, batchID)
	if err != nil {
		return nil, err
	}
	idx := map[uuid.UUID]int{}
	for rows.Next() {
		var c Completion
		var id uuid.UUID
		if err := rows.Scan(&id, &c.CompletedAt, &c.WorkerName, &c.Mats); err != nil {
			rows.Close()
			return nil, err
		}
		c.PhaseLogID, c.Plan, c.Movements = &id, []PlanRow{}, []Movement{}
		idx[id] = len(out.Completions)
		out.Completions = append(out.Completions, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	bucket := func(pl *uuid.UUID) *Completion {
		if pl != nil {
			if i, ok := idx[*pl]; ok {
				return &out.Completions[i]
			}
		}
		for i := range out.Completions { // one "unlinked" group, created on demand
			if out.Completions[i].PhaseLogID == nil {
				return &out.Completions[i]
			}
		}
		out.Completions = append(out.Completions, Completion{Plan: []PlanRow{}, Movements: []Movement{}})
		return &out.Completions[len(out.Completions)-1]
	}

	rows, err = s.pool.Query(ctx, `
		SELECT p.id, p.phase_log_id, p.material_type_id, t.code, t.name, t.unit::text, p.variant_id, v.name, p.source,
		       (p.qty_per_mat * 1000)::bigint, p.mats, (p.planned_qty * 1000)::bigint, p.note, p.created_at
		FROM batch_material_plan p JOIN material_types t ON t.id = p.material_type_id
		LEFT JOIN material_variants v ON v.id = p.variant_id
		WHERE p.batch_id = $1 ORDER BY p.created_at, t.sort, t.id`, batchID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var p PlanRow
		if err := rows.Scan(&p.ID, &p.PhaseLogID, &p.MaterialTypeID, &p.TypeCode, &p.TypeName, &p.Unit, &p.VariantID,
			&p.VariantName, &p.Source, &p.QtyPerMat, &p.Mats, &p.PlannedQty, &p.Note, &p.CreatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		c := bucket(p.PhaseLogID)
		c.Plan = append(c.Plan, p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.pool.Query(ctx, movementSelect+`
		WHERE m.batch_id = $1 AND m.kind = 'consume'
		ORDER BY m.created_at, t.sort, (m.lot_id IS NULL), l.received_at`, batchID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		m, err := scanMovement(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		c := bucket(m.PhaseLogID)
		c.Movements = append(c.Movements, *m)
	}
	rows.Close()
	return out, rows.Err()
}

// ───────────────────────── cutter: what to take ─────────────────────────

type NeededLot struct {
	LotCode string  `json:"lot_code"`
	Color   string  `json:"color"`
	Width   *string `json:"width,omitempty"` // variant name, e.g. 60″
	Qty     Milli   `json:"qty"`
}

type NeededLine struct {
	MaterialTypeID int         `json:"material_type_id"`
	TypeName       string      `json:"type_name"`
	Unit           string      `json:"unit"`
	Source         string      `json:"source"`
	Need           *Milli      `json:"need,omitempty"` // nil = no recipe quantity
	Lots           []NeededLot `json:"lots"`
	Shortfall      Milli       `json:"shortfall"`
}

type MaterialsNeeded struct {
	BatchID   uuid.UUID    `json:"batch_id"`
	BatchCode string       `json:"batch_code"`
	Mats      int          `json:"mats"` // remaining to cut
	Lines     []NeededLine `json:"lines"`
	Notes     []string     `json:"notes"`
}

// MaterialsNeeded resolves the batch's REMAINING mats to cut (quantity − cut_qty while in cutting). Read-only.
func (s *Service) MaterialsNeeded(ctx context.Context, batchID uuid.UUID) (*MaterialsNeeded, error) {
	var carID, quantity, cutQty int
	var phase string
	var rollID *uuid.UUID
	out := &MaterialsNeeded{BatchID: batchID, Lines: []NeededLine{}, Notes: []string{}}
	err := s.pool.QueryRow(ctx, `SELECT batch_code, car_model_id, quantity, cut_qty, current_phase::text, roll_id FROM batches WHERE id = $1`,
		batchID).Scan(&out.BatchCode, &carID, &quantity, &cutQty, &phase, &rollID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("%w: batch %s", ErrNotFound, batchID)
	}
	if err != nil {
		return nil, err
	}
	if phase == "cutting" && quantity > cutQty {
		out.Mats = quantity - cutQty
	}
	plan, err := BuildPlan(ctx, s.pool, PlanInput{CarModelID: carID, RollID: rollID, Mats: out.Mats})
	if err != nil {
		return nil, err
	}
	out.Notes = plan.Notes
	for _, l := range plan.Lines {
		nl := NeededLine{MaterialTypeID: l.MaterialTypeID, TypeName: l.TypeName, Unit: l.Unit, Source: l.Source,
			Need: l.Need, Shortfall: l.Shortfall, Lots: []NeededLot{}}
		if l.Need != nil && *l.Need == 0 {
			continue // override 0: this car doesn't use it — nothing to fetch
		}
		for _, d := range l.Draws {
			nl.Lots = append(nl.Lots, NeededLot{LotCode: d.LotCode, Color: d.Color, Width: d.VariantName, Qty: d.Qty})
		}
		out.Lines = append(out.Lines, nl)
	}
	return out, nil
}
