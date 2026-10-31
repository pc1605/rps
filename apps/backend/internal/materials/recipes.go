package materials

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/pc1605/rps/apps/backend/internal/audit"
)

// ───────────────────────── consumption groups ─────────────────────────

type Group struct {
	ID             int       `json:"id"`
	Name           string    `json:"name"`
	Sort           int       `json:"sort"`
	IsActive       bool      `json:"is_active"`
	DefaultForSize *string   `json:"default_for_size,omitempty"`
	CarCount       int       `json:"car_count"`
	CreatedAt      time.Time `json:"created_at"`
}

type GroupInput struct {
	Name           *string     `json:"name"`
	Sort           *int        `json:"sort"`
	IsActive       *bool       `json:"is_active"`
	DefaultForSize Opt[string] `json:"default_for_size"` // null clears
}

var sizes = map[string]bool{"small": true, "medium": true, "large": true}

const groupSelect = `
	SELECT g.id, g.name, g.sort, g.is_active, g.default_for_size::text,
	       (SELECT COUNT(*) FROM car_models cm WHERE cm.consumption_group_id = g.id), g.created_at
	FROM consumption_groups g`

func scanGroup(row pgx.Row) (*Group, error) {
	var g Group
	if err := row.Scan(&g.ID, &g.Name, &g.Sort, &g.IsActive, &g.DefaultForSize, &g.CarCount, &g.CreatedAt); err != nil {
		return nil, err
	}
	return &g, nil
}

func (s *Service) ListGroups(ctx context.Context) ([]Group, error) {
	rows, err := s.pool.Query(ctx, groupSelect+` ORDER BY g.sort, g.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Group{}
	for rows.Next() {
		g, err := scanGroup(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *g)
	}
	return out, rows.Err()
}

func (s *Service) getGroup(ctx context.Context, q Querier, id int) (*Group, error) {
	g, err := scanGroup(q.QueryRow(ctx, groupSelect+` WHERE g.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("%w: consumption group %d", ErrNotFound, id)
	}
	return g, err
}

func normGroup(in *GroupInput) error {
	if in.Name != nil {
		n := strings.TrimSpace(*in.Name)
		if n == "" {
			return invalid("name is required")
		}
		in.Name = &n
	}
	if v := in.DefaultForSize.Value; v != nil && !sizes[*v] {
		return invalid("default_for_size must be small, medium or large (or null)")
	}
	return nil
}

func groupDupErr(err error) error {
	if isUnique(err) {
		return fmt.Errorf("%w: a group with that name, or the default for that size, already exists", ErrDuplicate)
	}
	return err
}

func (s *Service) CreateGroup(ctx context.Context, in GroupInput, a Actor) (*Group, error) {
	if in.Name == nil {
		return nil, invalid("name is required")
	}
	if err := normGroup(&in); err != nil {
		return nil, err
	}
	sort, active := 0, true
	if in.Sort != nil {
		sort = *in.Sort
	}
	if in.IsActive != nil {
		active = *in.IsActive
	}
	if !active && in.DefaultForSize.Value != nil {
		return nil, ErrGroupIsDefault
	}
	var out *Group
	err := s.withTx(ctx, func(tx pgx.Tx) error {
		var id int
		if err := tx.QueryRow(ctx, `
			INSERT INTO consumption_groups (name, sort, is_active, default_for_size) VALUES ($1, $2, $3, $4::car_size) RETURNING id`,
			*in.Name, sort, active, in.DefaultForSize.Value).Scan(&id); err != nil {
			return groupDupErr(err)
		}
		g, err := s.getGroup(ctx, tx, id)
		if err != nil {
			return err
		}
		out = g
		return writeAudit(ctx, tx, a, "consumption_group", fmt.Sprint(id), audit.ActionCreate, nil, g)
	})
	return out, err
}

func (s *Service) UpdateGroup(ctx context.Context, id int, in GroupInput, a Actor) (*Group, error) {
	if err := normGroup(&in); err != nil {
		return nil, err
	}
	var out *Group
	err := s.withTx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT 1 FROM consumption_groups WHERE id = $1 FOR UPDATE`, id); err != nil {
			return err
		}
		before, err := s.getGroup(ctx, tx, id)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE consumption_groups SET name = COALESCE($2, name), sort = COALESCE($3, sort),
			  is_active = COALESCE($4, is_active),
			  default_for_size = CASE WHEN $5 THEN $6::car_size ELSE default_for_size END
			WHERE id = $1`, id, in.Name, in.Sort, in.IsActive, in.DefaultForSize.Set, in.DefaultForSize.Value); err != nil {
			return groupDupErr(err)
		}
		after, err := s.getGroup(ctx, tx, id)
		if err != nil {
			return err
		}
		if !after.IsActive {
			if after.CarCount > 0 {
				return fmt.Errorf("%w (%d cars)", ErrGroupInUse, after.CarCount)
			}
			if after.DefaultForSize != nil {
				return ErrGroupIsDefault
			}
		}
		out = after
		return writeAudit(ctx, tx, a, "consumption_group", fmt.Sprint(id), audit.ActionUpdate, before, after)
	})
	return out, err
}

// ───────────────────────── recipes & overrides ─────────────────────────

type LineRow struct {
	ID             int     `json:"id"`
	MaterialTypeID int     `json:"material_type_id"`
	TypeCode       string  `json:"type_code"`
	TypeName       string  `json:"type_name"`
	Unit           string  `json:"unit"`
	VariantID      *int    `json:"variant_id,omitempty"`
	VariantName    *string `json:"variant_name,omitempty"`
	QtyPerMat      Milli   `json:"qty_per_mat"`
}

type LineInput struct {
	MaterialTypeID int   `json:"material_type_id"`
	VariantID      *int  `json:"variant_id"`
	QtyPerMat      Milli `json:"qty_per_mat"`
}

type ProductLineRef struct {
	ID   int    `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

type RecipeGridGroup struct {
	Group    Group     `json:"group"`
	RecipeID *int      `json:"recipe_id,omitempty"`
	Note     *string   `json:"note,omitempty"`
	Lines    []LineRow `json:"lines"`
}

type RecipeGrid struct {
	ProductLine ProductLineRef    `json:"product_line"`
	Groups      []RecipeGridGroup `json:"groups"`
}

type CarOverrides struct {
	CarModelID int       `json:"car_model_id"`
	Lines      []LineRow `json:"lines"`
}

func lineRows(ctx context.Context, q Querier, sql string, args ...any) ([]LineRow, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []LineRow{}
	for rows.Next() {
		var l LineRow
		if err := rows.Scan(&l.ID, &l.MaterialTypeID, &l.TypeCode, &l.TypeName, &l.Unit, &l.VariantID, &l.VariantName, &l.QtyPerMat); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

const recipeLineSelect = `
	SELECT rl.id, rl.material_type_id, t.code, t.name, t.unit::text, rl.variant_id, v.name, (rl.qty_per_mat * 1000)::bigint
	FROM recipe_lines rl JOIN material_types t ON t.id = rl.material_type_id
	LEFT JOIN material_variants v ON v.id = rl.variant_id
	WHERE rl.recipe_id = $1 ORDER BY t.sort, t.id, v.name NULLS FIRST`

const overrideSelect = `
	SELECT o.id, o.material_type_id, t.code, t.name, t.unit::text, o.variant_id, v.name, (o.qty_per_mat * 1000)::bigint
	FROM car_material_overrides o JOIN material_types t ON t.id = o.material_type_id
	LEFT JOIN material_variants v ON v.id = o.variant_id
	WHERE o.car_model_id = $1 ORDER BY t.sort, t.id, v.name NULLS FIRST`

func (s *Service) productLine(ctx context.Context, q Querier, id int) (*ProductLineRef, error) {
	var p ProductLineRef
	err := q.QueryRow(ctx, `SELECT id, code, name FROM product_lines WHERE id = $1`, id).Scan(&p.ID, &p.Code, &p.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("%w: product line %d", ErrNotFound, id)
	}
	return &p, err
}

// RecipeGrid returns every consumption group with its recipe lines for one product line.
func (s *Service) RecipeGrid(ctx context.Context, productLineID int) (*RecipeGrid, error) {
	pl, err := s.productLine(ctx, s.pool, productLineID)
	if err != nil {
		return nil, err
	}
	groups, err := s.ListGroups(ctx)
	if err != nil {
		return nil, err
	}
	grid := &RecipeGrid{ProductLine: *pl, Groups: []RecipeGridGroup{}}
	for _, g := range groups {
		gg := RecipeGridGroup{Group: g, Lines: []LineRow{}}
		var rid int
		var note *string
		err := s.pool.QueryRow(ctx, `SELECT id, note FROM recipes WHERE product_line_id = $1 AND consumption_group_id = $2`,
			productLineID, g.ID).Scan(&rid, &note)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
		case err != nil:
			return nil, err
		default:
			gg.RecipeID, gg.Note = &rid, note
			if gg.Lines, err = lineRows(ctx, s.pool, recipeLineSelect, rid); err != nil {
				return nil, err
			}
		}
		grid.Groups = append(grid.Groups, gg)
	}
	return grid, nil
}

// validateLines: types exist; a variant belongs to its type and the type has variants;
// qty > 0 (recipes) or ≥ 0 (overrides, 0 = "doesn't use it"); no duplicate (type, variant).
func validateLines(ctx context.Context, q Querier, lines []LineInput, allowZero bool) error {
	seen := map[string]bool{}
	for i, l := range lines {
		if l.MaterialTypeID <= 0 {
			return invalid("line %d: material_type_id is required", i+1)
		}
		if l.QtyPerMat < 0 || (!allowZero && l.QtyPerMat == 0) {
			if allowZero {
				return invalid("line %d: qty_per_mat must be ≥ 0", i+1)
			}
			return invalid("line %d: qty_per_mat must be > 0", i+1)
		}
		key := fmt.Sprintf("%d/%v", l.MaterialTypeID, derefOr(l.VariantID, 0))
		if seen[key] {
			return invalid("line %d: duplicate material type + variant", i+1)
		}
		seen[key] = true
		var hasVariants bool
		err := q.QueryRow(ctx, `SELECT has_variants FROM material_types WHERE id = $1`, l.MaterialTypeID).Scan(&hasVariants)
		if errors.Is(err, pgx.ErrNoRows) {
			return invalid("line %d: material type %d not found", i+1, l.MaterialTypeID)
		}
		if err != nil {
			return err
		}
		if l.VariantID != nil {
			if !hasVariants {
				return invalid("line %d: material type %d has no variants", i+1, l.MaterialTypeID)
			}
			var ok bool
			if err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM material_variants WHERE id = $1 AND material_type_id = $2)`,
				*l.VariantID, l.MaterialTypeID).Scan(&ok); err != nil {
				return err
			}
			if !ok {
				return invalid("line %d: variant %d is not a variant of material type %d", i+1, *l.VariantID, l.MaterialTypeID)
			}
		}
	}
	return nil
}

// PutRecipeLines replaces the lines of (product line × group), creating the recipe row if needed.
func (s *Service) PutRecipeLines(ctx context.Context, productLineID, groupID int, lines []LineInput, a Actor) (*RecipeGridGroup, error) {
	var out *RecipeGridGroup
	err := s.withTx(ctx, func(tx pgx.Tx) error {
		if _, err := s.productLine(ctx, tx, productLineID); err != nil {
			return err
		}
		g, err := s.getGroup(ctx, tx, groupID)
		if err != nil {
			return err
		}
		if err := validateLines(ctx, tx, lines, false); err != nil {
			return err
		}
		var rid int
		var note *string
		if err := tx.QueryRow(ctx, `
			INSERT INTO recipes (product_line_id, consumption_group_id) VALUES ($1, $2)
			ON CONFLICT (product_line_id, consumption_group_id) DO UPDATE SET updated_at = NOW()
			RETURNING id, note`, productLineID, groupID).Scan(&rid, &note); err != nil {
			return err
		}
		before, err := lineRows(ctx, tx, recipeLineSelect, rid)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM recipe_lines WHERE recipe_id = $1`, rid); err != nil {
			return err
		}
		for _, l := range lines {
			if _, err := tx.Exec(ctx, `
				INSERT INTO recipe_lines (recipe_id, material_type_id, variant_id, qty_per_mat)
				VALUES ($1, $2, $3, $4::bigint::numeric / 1000)`, rid, l.MaterialTypeID, l.VariantID, int64(l.QtyPerMat)); err != nil {
				return err
			}
		}
		after, err := lineRows(ctx, tx, recipeLineSelect, rid)
		if err != nil {
			return err
		}
		out = &RecipeGridGroup{Group: *g, RecipeID: &rid, Note: note, Lines: after}
		return writeAudit(ctx, tx, a, "recipe", fmt.Sprint(rid), audit.ActionUpdate,
			map[string]any{"lines": before}, map[string]any{"product_line_id": productLineID, "consumption_group_id": groupID, "lines": after})
	})
	return out, err
}

func (s *Service) carExists(ctx context.Context, q Querier, id int) error {
	var ok bool
	if err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM car_models WHERE id = $1)`, id).Scan(&ok); err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("%w: car model %d", ErrNotFound, id)
	}
	return nil
}

func (s *Service) GetOverrides(ctx context.Context, carID int) (*CarOverrides, error) {
	if err := s.carExists(ctx, s.pool, carID); err != nil {
		return nil, err
	}
	lines, err := lineRows(ctx, s.pool, overrideSelect, carID)
	if err != nil {
		return nil, err
	}
	return &CarOverrides{CarModelID: carID, Lines: lines}, nil
}

func (s *Service) PutOverrides(ctx context.Context, carID int, lines []LineInput, a Actor) (*CarOverrides, error) {
	var out *CarOverrides
	err := s.withTx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT 1 FROM car_models WHERE id = $1 FOR UPDATE`, carID); err != nil {
			return err
		}
		if err := s.carExists(ctx, tx, carID); err != nil {
			return err
		}
		if err := validateLines(ctx, tx, lines, true); err != nil {
			return err
		}
		before, err := lineRows(ctx, tx, overrideSelect, carID)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM car_material_overrides WHERE car_model_id = $1`, carID); err != nil {
			return err
		}
		for _, l := range lines {
			if _, err := tx.Exec(ctx, `
				INSERT INTO car_material_overrides (car_model_id, material_type_id, variant_id, qty_per_mat)
				VALUES ($1, $2, $3, $4::bigint::numeric / 1000)`, carID, l.MaterialTypeID, l.VariantID, int64(l.QtyPerMat)); err != nil {
				return err
			}
		}
		after, err := lineRows(ctx, tx, overrideSelect, carID)
		if err != nil {
			return err
		}
		out = &CarOverrides{CarModelID: carID, Lines: after}
		return writeAudit(ctx, tx, a, "car_material_overrides", fmt.Sprint(carID), audit.ActionUpdate,
			map[string]any{"lines": before}, map[string]any{"lines": after})
	})
	return out, err
}

func derefOr(p *int, d int) int {
	if p == nil {
		return d
	}
	return *p
}
