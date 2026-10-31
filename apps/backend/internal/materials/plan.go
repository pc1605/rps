package materials

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Planner: recipe resolution + lot selection, shared by the cutting consumption engine
// (batch.consumeForCutting, ForUpdate=true inside its tx) and the read-only dry runs
// (GET /recipes/resolve, GET /worker/batches/:id/materials-needed). Design: materials.md.

// Plan sources, most specific first.
const (
	SourceCarVariant    = "car_variant"
	SourceCarAny        = "car_any"
	SourceRecipeVariant = "recipe_variant"
	SourceRecipeAny     = "recipe_any"
	SourceNone          = "none"
)

// QtyLine is one recipe line or car override: quantity per mat for a material type,
// optionally only for one variant (VariantID nil = any variant).
type QtyLine struct {
	TypeID    int
	VariantID *int
	Qty       Milli
}

// RecipeLines are the lines of the car's recipe (product line × consumption group).
type RecipeLines []QtyLine

// Overrides are the car's per-type exceptions; Qty 0 = "this car doesn't use it".
type Overrides []QtyLine

func find(lines []QtyLine, typeID int, variantID *int) (Milli, bool) {
	for _, l := range lines {
		if l.TypeID == typeID && sameInt(l.VariantID, variantID) {
			return l.Qty, true
		}
	}
	return 0, false
}

// resolveQty: quantity per mat for the variant actually used (nil = no variant), and the rule
// that produced it: car_variant > car_any > recipe_variant > recipe_any > none.
// A zero override returns qty 0 (type not consumed). Source none returns nil.
func resolveQty(lines RecipeLines, overrides Overrides, typeID int, variantID *int) (*Milli, string) {
	if variantID != nil {
		if q, ok := find(overrides, typeID, variantID); ok {
			return &q, SourceCarVariant
		}
	}
	if q, ok := find(overrides, typeID, nil); ok {
		return &q, SourceCarAny
	}
	if variantID != nil {
		if q, ok := find(lines, typeID, variantID); ok {
			return &q, SourceRecipeVariant
		}
	}
	if q, ok := find(lines, typeID, nil); ok {
		return &q, SourceRecipeAny
	}
	return nil, SourceNone
}

type PlanInput struct {
	CarModelID int
	RollID     *uuid.UUID // the batch's chosen lot (covers its own type); nil = all FIFO
	Mats       int
	ForUpdate  bool // lock candidate lots (engine); false = read-only dry run
}

// Draw is one planned take from a lot.
type Draw struct {
	LotID       uuid.UUID `json:"lot_id"`
	LotCode     string    `json:"lot_code"`
	Color       string    `json:"color"`
	VariantID   *int      `json:"variant_id,omitempty"`
	VariantName *string   `json:"variant_name,omitempty"`
	Qty         Milli     `json:"qty"`
}

// PlanLine is the outcome for one material type.
type PlanLine struct {
	MaterialTypeID int     `json:"material_type_id"`
	TypeCode       string  `json:"type_code"`
	TypeName       string  `json:"type_name"`
	Unit           string  `json:"unit"`
	VariantID      *int    `json:"variant_id,omitempty"` // variant the quantity was resolved for
	VariantName    *string `json:"variant_name,omitempty"`
	Source         string  `json:"source"`
	QtyPerMat      *Milli  `json:"qty_per_mat,omitempty"` // nil when source = none
	Need           *Milli  `json:"need,omitempty"`        // qty_per_mat × mats; nil when none
	Available      Milli   `json:"available"`             // stock in the lots this type may draw from
	Shortfall      Milli   `json:"shortfall"`             // need − drawn
	Draws          []Draw  `json:"draws"`
	Note           *string `json:"note,omitempty"`
}

type Plan struct {
	Mats  int        `json:"mats"`
	Lines []PlanLine `json:"lines"`
	// Notes are appended to the batch by the engine: no-recipe and shortfall messages.
	Notes []string `json:"notes"`
}

type planLot struct {
	ID          uuid.UUID
	TypeID      int
	VariantID   *int
	VariantName *string
	Code, Color string
	Remaining   Milli
	ReceivedAt  time.Time
}

// unitLabel mirrors @rps/shared MATERIAL_UNIT_LABEL for notes.
func unitLabel(u string) string {
	if u == "sqm" {
		return "m²"
	}
	return u
}

func loadQtyLines(ctx context.Context, q Querier, sql string, args ...any) ([]QtyLine, error) {
	rows, err := q.Query(ctx, sql, args...)
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

// BuildPlan resolves quantities and selects lots for `Mats` mats of a car. It never writes.
// With ForUpdate it locks every candidate lot in id order (deadlock-free across concurrent cuts).
func BuildPlan(ctx context.Context, q Querier, in PlanInput) (*Plan, error) {
	plan := &Plan{Mats: in.Mats, Lines: []PlanLine{}, Notes: []string{}}
	if in.Mats <= 0 {
		return plan, nil
	}

	// 1. Recipe key, lines, overrides, the roll.
	var lineID *int
	var groupID int
	err := q.QueryRow(ctx, `SELECT product_line_id, consumption_group_id FROM car_models WHERE id = $1`, in.CarModelID).Scan(&lineID, &groupID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("%w: car model %d", ErrNotFound, in.CarModelID)
	}
	if err != nil {
		return nil, fmt.Errorf("plan: car: %w", err)
	}
	var lines RecipeLines
	if lineID != nil {
		if lines, err = loadQtyLines(ctx, q, `
			SELECT rl.material_type_id, rl.variant_id, (rl.qty_per_mat * 1000)::bigint
			FROM recipe_lines rl JOIN recipes r ON r.id = rl.recipe_id
			WHERE r.product_line_id = $1 AND r.consumption_group_id = $2`, *lineID, groupID); err != nil {
			return nil, fmt.Errorf("plan: recipe lines: %w", err)
		}
	}
	overrides, err := loadQtyLines(ctx, q, `
		SELECT material_type_id, variant_id, (qty_per_mat * 1000)::bigint
		FROM car_material_overrides WHERE car_model_id = $1`, in.CarModelID)
	if err != nil {
		return nil, fmt.Errorf("plan: overrides: %w", err)
	}
	var rollType, rollVariant *int
	if in.RollID != nil {
		var t int
		var v *int
		err := q.QueryRow(ctx, `SELECT material_type_id, variant_id FROM material_lots WHERE id = $1`, *in.RollID).Scan(&t, &v)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: lot %s", ErrNotFound, *in.RollID)
		}
		if err != nil {
			return nil, fmt.Errorf("plan: roll lot: %w", err)
		}
		rollType, rollVariant = &t, v
	}

	// Types needed = recipe ∪ overrides ∪ the roll's own type, in id order.
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
	if len(need) == 0 {
		plan.Notes = append(plan.Notes, "Materials not recorded: no recipe for this car's product line × consumption group")
		return plan, nil
	}
	typeIDs := make([]int, 0, len(need))
	for id := range need {
		typeIDs = append(typeIDs, id)
	}
	sort.Ints(typeIDs)

	type typeInfo struct{ code, name, unit string }
	types := map[int]typeInfo{}
	rows, err := q.Query(ctx, `SELECT id, code, name, unit::text FROM material_types WHERE id = ANY($1)`, typeIDs)
	if err != nil {
		return nil, fmt.Errorf("plan: types: %w", err)
	}
	for rows.Next() {
		var id int
		var t typeInfo
		if err := rows.Scan(&id, &t.code, &t.name, &t.unit); err != nil {
			rows.Close()
			return nil, err
		}
		types[id] = t
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	variantNames := map[int]string{}
	rows, err = q.Query(ctx, `SELECT id, name FROM material_variants WHERE material_type_id = ANY($1)`, typeIDs)
	if err != nil {
		return nil, fmt.Errorf("plan: variants: %w", err)
	}
	for rows.Next() {
		var id int
		var n string
		if err := rows.Scan(&id, &n); err != nil {
			rows.Close()
			return nil, err
		}
		variantNames[id] = n
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	vname := func(v *int) *string {
		if v == nil {
			return nil
		}
		n := variantNames[*v]
		return &n
	}

	// 2. Candidate lots in one statement, id order (FOR UPDATE in the engine).
	lockSQL := `
		SELECT id, material_type_id, variant_id, lot_code, color, (qty_remaining * 1000)::bigint, received_at
		FROM material_lots
		WHERE material_type_id = ANY($1) AND is_active AND qty_remaining > 0
		ORDER BY id`
	if in.ForUpdate {
		lockSQL += ` FOR UPDATE`
	}
	byType := map[int][]*planLot{}
	rows, err = q.Query(ctx, lockSQL, typeIDs)
	if err != nil {
		return nil, fmt.Errorf("plan: lots: %w", err)
	}
	for rows.Next() {
		l := &planLot{}
		if err := rows.Scan(&l.ID, &l.TypeID, &l.VariantID, &l.Code, &l.Color, &l.Remaining, &l.ReceivedAt); err != nil {
			rows.Close()
			return nil, err
		}
		l.VariantName = vname(l.VariantID)
		byType[l.TypeID] = append(byType[l.TypeID], l)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for _, ls := range byType { // FIFO: oldest received first, id as tie-break
		sort.SliceStable(ls, func(i, j int) bool {
			if !ls[i].ReceivedAt.Equal(ls[j].ReceivedAt) {
				return ls[i].ReceivedAt.Before(ls[j].ReceivedAt)
			}
			return ls[i].ID.String() < ls[j].ID.String()
		})
	}

	// 3. Per type: lot order + variant V, resolve, draw.
	for _, tid := range typeIDs {
		ti := types[tid]
		lots := byType[tid]
		eligible := func(l *planLot) bool {
			_, src := resolveQty(lines, overrides, tid, l.VariantID)
			return src != SourceNone
		}
		var order []*planLot
		var variant *int
		if rollType != nil && *rollType == tid {
			// The batch's roll covers its own type: it goes first; V = the roll's variant.
			variant = rollVariant
			for _, l := range lots {
				if l.ID == *in.RollID {
					order = append(order, l)
				}
			}
			for _, l := range lots {
				if l.ID != *in.RollID && eligible(l) {
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

		pl := PlanLine{MaterialTypeID: tid, TypeCode: ti.code, TypeName: ti.name, Unit: ti.unit,
			VariantID: variant, VariantName: vname(variant), Draws: []Draw{}}
		for _, l := range order {
			pl.Available += l.Remaining
		}
		qty, source := resolveQty(lines, overrides, tid, variant)
		pl.Source = source
		if source == SourceNone {
			note := "No recipe quantity for " + ti.name
			if pl.VariantName != nil {
				note += " (" + *pl.VariantName + ")"
			}
			pl.Note = &note
			plan.Notes = append(plan.Notes, note)
			plan.Lines = append(plan.Lines, pl)
			continue
		}
		needQty := *qty * Milli(in.Mats)
		pl.QtyPerMat, pl.Need = qty, &needQty
		left := needQty
		for _, l := range order {
			if left == 0 {
				break
			}
			d := min(l.Remaining, left)
			if d <= 0 {
				continue
			}
			pl.Draws = append(pl.Draws, Draw{LotID: l.ID, LotCode: l.Code, Color: l.Color, VariantID: l.VariantID, VariantName: l.VariantName, Qty: d})
			left -= d
		}
		if left > 0 {
			pl.Shortfall = left
			note := fmt.Sprintf("Material shortfall: %s %s %s", ti.name, left, unitLabel(ti.unit))
			pl.Note = &note
			plan.Notes = append(plan.Notes, note)
		}
		plan.Lines = append(plan.Lines, pl)
	}
	return plan, nil
}
