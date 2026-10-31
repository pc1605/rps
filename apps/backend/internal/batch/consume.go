package batch

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/pc1605/rps/apps/backend/internal/materials"
)

// Material consumption at cutting-complete (Slice C1b). Design: docs/rps-kb/02-domain/materials.md.
// Resolution + lot selection live in materials.BuildPlan (shared with the read-only dry runs);
// this applies the plan: consume movements, shortfalls, plan rows, batch notes.

// consumeForCutting records material use for one cutting completion (`mats` pieces, closed log
// `phaseLogID`) INSIDE the caller's transaction. It never fails for stock problems — missing
// recipes and shortfalls become plan rows / notes — only for real DB errors. A second run for
// the same completion fails on uq_plan_completion_type.
func consumeForCutting(ctx context.Context, tx pgx.Tx, batchID, phaseLogID uuid.UUID, mats int, actorWorkerID uuid.UUID) error {
	if mats <= 0 {
		return nil
	}
	var carID int
	var rollID *uuid.UUID
	if err := tx.QueryRow(ctx, `SELECT car_model_id, roll_id FROM batches WHERE id = $1`, batchID).Scan(&carID, &rollID); err != nil {
		return fmt.Errorf("consume: load batch: %w", err)
	}
	plan, err := materials.BuildPlan(ctx, tx, materials.PlanInput{CarModelID: carID, RollID: rollID, Mats: mats, ForUpdate: true})
	if err != nil {
		return fmt.Errorf("consume: %w", err)
	}
	for _, l := range plan.Lines {
		for _, d := range l.Draws {
			lot := d.LotID
			if _, err := materials.InsertMovement(ctx, tx, materials.MovementInput{
				LotID: &lot, TypeID: l.MaterialTypeID, VariantID: d.VariantID, Kind: "consume", Qty: -d.Qty,
				BatchID: &batchID, PhaseLogID: &phaseLogID, ActorWorkerID: &actorWorkerID, Reason: "cutting",
			}); err != nil {
				return fmt.Errorf("consume: %w", err)
			}
		}
		if l.Shortfall > 0 {
			if _, err := materials.InsertMovement(ctx, tx, materials.MovementInput{
				TypeID: l.MaterialTypeID, VariantID: l.VariantID, Kind: "consume", Qty: -l.Shortfall,
				BatchID: &batchID, PhaseLogID: &phaseLogID, ActorWorkerID: &actorWorkerID, Reason: "shortfall",
			}); err != nil {
				return fmt.Errorf("consume: %w", err)
			}
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO batch_material_plan
			  (batch_id, phase_log_id, material_type_id, variant_id, source, qty_per_mat, mats, planned_qty, note)
			VALUES ($1, $2, $3, $4, $5, $6::bigint::numeric / 1000, $7, $8::bigint::numeric / 1000, $9)`,
			batchID, phaseLogID, l.MaterialTypeID, l.VariantID, l.Source, milli(l.QtyPerMat), mats, milli(l.Need), l.Note); err != nil {
			return fmt.Errorf("consume: plan: %w", err)
		}
	}
	if len(plan.Notes) > 0 {
		if _, err := tx.Exec(ctx, `
			UPDATE batches SET notes = CONCAT_WS(E'\n', NULLIF(notes, ''), $1::text) WHERE id = $2`,
			strings.Join(plan.Notes, "\n"), batchID); err != nil {
			return fmt.Errorf("consume: batch notes: %w", err)
		}
	}
	return nil
}

func milli(m *materials.Milli) *int64 {
	if m == nil {
		return nil
	}
	v := int64(*m)
	return &v
}
