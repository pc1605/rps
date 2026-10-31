package batch

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Material consumption at cutting-complete (Slice C1b). Design: docs/rps-kb/02-domain/materials.md.

type consumeLot struct {
	ID         uuid.UUID
	TypeID     int
	VariantID  *int
	Remaining  Milli
	ReceivedAt time.Time
}

type consumeType struct {
	Name string
	Unit string
}

// unitLabel mirrors @rps/shared MATERIAL_UNIT_LABEL for batch notes.
func unitLabel(u string) string {
	if u == "sqm" {
		return "m²"
	}
	return u
}

// consumeForCutting records material use for one cutting completion (`mats` pieces,
// closed log `phaseLogID`) INSIDE the caller's transaction. It never fails for stock
// problems — missing recipes and shortfalls become plan rows / notes — only for real
// DB errors. A second run for the same completion fails on uq_plan_completion_type.
func consumeForCutting(ctx context.Context, tx pgx.Tx, batchID, phaseLogID uuid.UUID, mats int, actorWorkerID uuid.UUID) error {
	if mats <= 0 {
		return nil
	}

	// 1. Car → recipe key, recipe lines, overrides, the batch's roll.
	var (
		carID   int
		lineID  *int
		groupID int
		rollID  *uuid.UUID
	)
	if err := tx.QueryRow(ctx, `
		SELECT b.car_model_id, cm.product_line_id, cm.consumption_group_id, b.roll_id
		FROM batches b JOIN car_models cm ON cm.id = b.car_model_id
		WHERE b.id = $1`, batchID).Scan(&carID, &lineID, &groupID, &rollID); err != nil {
		return fmt.Errorf("consume: load batch: %w", err)
	}

	var lines RecipeLines
	if lineID != nil {
		var err error
		if lines, err = loadQtyLines(ctx, tx, `
			SELECT rl.material_type_id, rl.variant_id, (rl.qty_per_mat * 1000)::bigint
			FROM recipe_lines rl JOIN recipes r ON r.id = rl.recipe_id
			WHERE r.product_line_id = $1 AND r.consumption_group_id = $2`, *lineID, groupID); err != nil {
			return fmt.Errorf("consume: recipe lines: %w", err)
		}
	}
	overrides, err := loadQtyLines(ctx, tx, `
		SELECT material_type_id, variant_id, (qty_per_mat * 1000)::bigint
		FROM car_material_overrides WHERE car_model_id = $1`, carID)
	if err != nil {
		return fmt.Errorf("consume: overrides: %w", err)
	}

	var rollType, rollVariant *int
	if rollID != nil {
		var t int
		var v *int
		if err := tx.QueryRow(ctx, `SELECT material_type_id, variant_id FROM material_lots WHERE id = $1`, *rollID).Scan(&t, &v); err != nil {
			return fmt.Errorf("consume: roll lot: %w", err)
		}
		rollType, rollVariant = &t, v
	}

	// Types needed = recipe ∪ overrides ∪ the roll's own type, in stable id order.
	need := map[int]bool{}
	for _, l := range lines {
		need[l.TypeID] = true
	}
	for _, o := range overrides {
		need[o.TypeID] = true
	}
	if rollType != nil {
		need[*rollType] = true
	}
	var batchNotes []string
	if len(need) == 0 {
		batchNotes = append(batchNotes, "Materials not recorded: no recipe for this car's product line × consumption group")
		return appendBatchNotes(ctx, tx, batchID, batchNotes)
	}
	typeIDs := make([]int, 0, len(need))
	for id := range need {
		typeIDs = append(typeIDs, id)
	}
	sort.Ints(typeIDs)

	types := map[int]consumeType{}
	rows, err := tx.Query(ctx, `SELECT id, name, unit::text FROM material_types WHERE id = ANY($1)`, typeIDs)
	if err != nil {
		return fmt.Errorf("consume: types: %w", err)
	}
	for rows.Next() {
		var id int
		var t consumeType
		if err := rows.Scan(&id, &t.Name, &t.Unit); err != nil {
			rows.Close()
			return err
		}
		types[id] = t
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	// 2. Lock every candidate lot in id order (one statement → no deadlock between concurrent cuts).
	byType := map[int][]*consumeLot{}
	rows, err = tx.Query(ctx, `
		SELECT id, material_type_id, variant_id, (qty_remaining * 1000)::bigint, received_at
		FROM material_lots
		WHERE material_type_id = ANY($1) AND is_active AND qty_remaining > 0
		ORDER BY id
		FOR UPDATE`, typeIDs)
	if err != nil {
		return fmt.Errorf("consume: lock lots: %w", err)
	}
	for rows.Next() {
		l := &consumeLot{}
		if err := rows.Scan(&l.ID, &l.TypeID, &l.VariantID, &l.Remaining, &l.ReceivedAt); err != nil {
			rows.Close()
			return err
		}
		byType[l.TypeID] = append(byType[l.TypeID], l)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, ls := range byType { // FIFO: oldest received first, id as tie-break
		sort.SliceStable(ls, func(i, j int) bool {
			if !ls[i].ReceivedAt.Equal(ls[j].ReceivedAt) {
				return ls[i].ReceivedAt.Before(ls[j].ReceivedAt)
			}
			return ls[i].ID.String() < ls[j].ID.String()
		})
	}

	// 3. Per type: choose lots + variant, resolve quantity, draw, record shortfall, write the plan row.
	for _, tid := range typeIDs {
		mt := types[tid]
		lots := byType[tid]
		eligible := func(l *consumeLot) bool {
			_, src := resolveQty(lines, overrides, tid, l.VariantID)
			return src != SourceNone
		}

		var order []*consumeLot
		var variant *int
		if rollType != nil && *rollType == tid {
			// The batch's roll covers its own type: it goes first; V = the roll's variant.
			variant = rollVariant
			for _, l := range lots {
				if l.ID == *rollID {
					order = append(order, l)
				}
			}
			for _, l := range lots {
				if l.ID != *rollID && eligible(l) {
					order = append(order, l)
				}
			}
		} else {
			// FIFO across lots whose variant has a quantity; V = variant of the first lot drawn.
			for _, l := range lots {
				if eligible(l) {
					order = append(order, l)
				}
			}
			switch {
			case len(order) > 0:
				variant = order[0].VariantID
			case len(lots) > 0:
				variant = lots[0].VariantID
			}
		}

		qty, source := resolveQty(lines, overrides, tid, variant)
		if source == SourceNone {
			note := fmt.Sprintf("No recipe quantity for %s", mt.Name)
			if variant != nil {
				var vname string
				if err := tx.QueryRow(ctx, `SELECT name FROM material_variants WHERE id = $1`, *variant).Scan(&vname); err != nil {
					return fmt.Errorf("consume: variant name: %w", err)
				}
				note += " (" + vname + ")"
			}
			if err := insertPlan(ctx, tx, batchID, phaseLogID, tid, variant, source, nil, mats, nil, &note); err != nil {
				return err
			}
			batchNotes = append(batchNotes, note)
			continue
		}

		needQty := *qty * Milli(mats)
		left := needQty
		for _, l := range order {
			if left == 0 {
				break
			}
			d := min(l.Remaining, left)
			if d <= 0 {
				continue
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO material_movements
				  (lot_id, material_type_id, variant_id, kind, qty, batch_id, phase_log_id, actor_worker_id, reason)
				VALUES ($1, $2, $3, 'consume', -($4::bigint::numeric / 1000), $5, $6, $7, 'cutting')`,
				l.ID, tid, l.VariantID, int64(d), batchID, phaseLogID, actorWorkerID); err != nil {
				return fmt.Errorf("consume: movement: %w", err)
			}
			if _, err := tx.Exec(ctx, `
				UPDATE material_lots SET qty_remaining = qty_remaining - ($1::bigint::numeric / 1000) WHERE id = $2`,
				int64(d), l.ID); err != nil {
				return fmt.Errorf("consume: lot: %w", err)
			}
			l.Remaining -= d
			left -= d
		}

		var planNote *string
		if left > 0 {
			if _, err := tx.Exec(ctx, `
				INSERT INTO material_movements
				  (lot_id, material_type_id, variant_id, kind, qty, batch_id, phase_log_id, actor_worker_id, reason)
				VALUES (NULL, $1, $2, 'consume', -($3::bigint::numeric / 1000), $4, $5, $6, 'shortfall')`,
				tid, variant, int64(left), batchID, phaseLogID, actorWorkerID); err != nil {
				return fmt.Errorf("consume: shortfall: %w", err)
			}
			n := fmt.Sprintf("Material shortfall: %s %s %s", mt.Name, left, unitLabel(mt.Unit))
			planNote = &n
			batchNotes = append(batchNotes, n)
		}

		q, p := int64(*qty), int64(needQty)
		if err := insertPlan(ctx, tx, batchID, phaseLogID, tid, variant, source, &q, mats, &p, planNote); err != nil {
			return err
		}
	}
	return appendBatchNotes(ctx, tx, batchID, batchNotes)
}

func loadQtyLines(ctx context.Context, tx pgx.Tx, sql string, args ...any) ([]QtyLine, error) {
	rows, err := tx.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []QtyLine
	for rows.Next() {
		var l QtyLine
		if err := rows.Scan(&l.TypeID, &l.VariantID, &l.Qty); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func insertPlan(ctx context.Context, tx pgx.Tx, batchID, phaseLogID uuid.UUID, typeID int, variantID *int,
	source string, qtyMilli *int64, mats int, plannedMilli *int64, note *string) error {
	if _, err := tx.Exec(ctx, `
		INSERT INTO batch_material_plan
		  (batch_id, phase_log_id, material_type_id, variant_id, source, qty_per_mat, mats, planned_qty, note)
		VALUES ($1, $2, $3, $4, $5, $6::bigint::numeric / 1000, $7, $8::bigint::numeric / 1000, $9)`,
		batchID, phaseLogID, typeID, variantID, source, qtyMilli, mats, plannedMilli, note); err != nil {
		return fmt.Errorf("consume: plan: %w", err)
	}
	return nil
}

func appendBatchNotes(ctx context.Context, tx pgx.Tx, batchID uuid.UUID, notes []string) error {
	if len(notes) == 0 {
		return nil
	}
	if _, err := tx.Exec(ctx, `
		UPDATE batches SET notes = CONCAT_WS(E'\n', NULLIF(notes, ''), $1::text) WHERE id = $2`,
		strings.Join(notes, "\n"), batchID); err != nil {
		return fmt.Errorf("consume: batch notes: %w", err)
	}
	return nil
}
