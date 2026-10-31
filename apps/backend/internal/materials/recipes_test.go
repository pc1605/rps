package materials

import (
	"fmt"
	"testing"
)

func TestGroupsRecipesOverrides(t *testing.T) {
	f := newStockFx(t)
	ip := func(v int) *int { return &v }
	sheet := f.typ("SHEET", "m", true)
	velcro := f.typ("VELCRO", "m", false)
	w60, _ := f.s.CreateVariant(f.ctx, sheet.ID, VariantInput{Name: sp("60″")}, f.a)
	other := f.typ("OTHER", "m", true)
	wOther, _ := f.s.CreateVariant(f.ctx, other.ID, VariantInput{Name: sp("54″")}, f.a)

	var lineID, carID int
	if err := f.pool.QueryRow(f.ctx, `INSERT INTO product_lines (code, name) VALUES ($1, $1) RETURNING id`, "T1C-"+f.sfx).Scan(&lineID); err != nil {
		t.Fatal(err)
	}
	g, err := f.s.CreateGroup(f.ctx, GroupInput{Name: sp("T grp " + f.sfx), Sort: ip(99)}, f.a)
	if err != nil {
		t.Fatalf("create group: %v", err)
	}
	if err := f.pool.QueryRow(f.ctx, `INSERT INTO car_models (brand_id, name, size_class, pieces_per_set, product_line_id, consumption_group_id)
		VALUES ((SELECT id FROM car_brands LIMIT 1), $1, 'medium', 4, $2, $3) RETURNING id`, "T car "+f.sfx, lineID, g.ID).Scan(&carID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { // FK order; runs before the type cleanup registered in newStockFx
		for _, q := range []string{
			fmt.Sprintf(`DELETE FROM car_models WHERE id = %d`, carID),
			fmt.Sprintf(`DELETE FROM recipes WHERE product_line_id = %d`, lineID),
			`DELETE FROM consumption_groups WHERE name LIKE 'T grp %'`,
			fmt.Sprintf(`DELETE FROM product_lines WHERE id = %d`, lineID),
		} {
			if _, err := f.pool.Exec(f.ctx, q); err != nil {
				t.Errorf("cleanup %q: %v", q, err)
			}
		}
	})

	// Groups.
	_, err = f.s.CreateGroup(f.ctx, GroupInput{Name: sp("t GRP " + f.sfx)}, f.a)
	is(t, "duplicate group name (case-insensitive)", err, ErrDuplicate)
	_, err = f.s.CreateGroup(f.ctx, GroupInput{Name: sp("T grp dflt " + f.sfx), DefaultForSize: Opt[string]{Set: true, Value: sp("small")}}, f.a)
	is(t, "second default for 'small'", err, ErrDuplicate)
	_, err = f.s.UpdateGroup(f.ctx, g.ID, GroupInput{IsActive: bp(false)}, f.a)
	is(t, "deactivate group used by a car", err, ErrGroupInUse)
	_, err = f.s.CreateGroup(f.ctx, GroupInput{Name: sp("T grp off " + f.sfx), IsActive: bp(false),
		DefaultForSize: Opt[string]{Set: true, Value: sp("large")}}, f.a)
	is(t, "inactive group as a size default", err, ErrGroupIsDefault)
	spare, err := f.s.CreateGroup(f.ctx, GroupInput{Name: sp("T grp spare " + f.sfx)}, f.a)
	if err != nil {
		t.Fatal(err)
	}
	if spare, err = f.s.UpdateGroup(f.ctx, spare.ID, GroupInput{IsActive: bp(false), Name: sp("T grp spare2 " + f.sfx)}, f.a); err != nil || spare.IsActive {
		t.Errorf("deactivate unused group: %+v, %v", spare, err)
	}

	// Recipes.
	bad := map[string][]LineInput{
		"variant of another type": {{MaterialTypeID: sheet.ID, VariantID: &wOther.ID, QtyPerMat: 1000}},
		"variant on a plain type": {{MaterialTypeID: velcro.ID, VariantID: &w60.ID, QtyPerMat: 1000}},
		"qty 0":                   {{MaterialTypeID: velcro.ID, QtyPerMat: 0}},
		"unknown type":            {{MaterialTypeID: 999999, QtyPerMat: 1000}},
		"duplicate type+variant":  {{MaterialTypeID: sheet.ID, QtyPerMat: 1000}, {MaterialTypeID: sheet.ID, QtyPerMat: 2000}},
	}
	for name, lines := range bad {
		_, err := f.s.PutRecipeLines(f.ctx, lineID, g.ID, lines, f.a)
		is(t, "recipe: "+name, err, ErrInvalid)
	}
	_, err = f.s.PutRecipeLines(f.ctx, 999999, g.ID, nil, f.a)
	is(t, "recipe: unknown product line", err, ErrNotFound)

	rg, err := f.s.PutRecipeLines(f.ctx, lineID, g.ID, []LineInput{
		{MaterialTypeID: sheet.ID, QtyPerMat: 2000},
		{MaterialTypeID: sheet.ID, VariantID: &w60.ID, QtyPerMat: 1500},
		{MaterialTypeID: velcro.ID, QtyPerMat: 500},
	}, f.a)
	if err != nil || rg.RecipeID == nil || len(rg.Lines) != 3 {
		t.Fatalf("put recipe: %+v, %v", rg, err)
	}
	grid, err := f.s.RecipeGrid(f.ctx, lineID)
	if err != nil {
		t.Fatal(err)
	}
	var found *RecipeGridGroup
	for i := range grid.Groups {
		if grid.Groups[i].Group.ID == g.ID {
			found = &grid.Groups[i]
		}
	}
	if found == nil || found.RecipeID == nil || *found.RecipeID != *rg.RecipeID || len(found.Lines) != 3 ||
		found.Lines[1].VariantName == nil || *found.Lines[1].VariantName != "60″" || found.Lines[1].QtyPerMat != 1500 {
		t.Fatalf("grid group = %+v", found)
	}
	// Replace with fewer lines; same recipe row.
	rg2, err := f.s.PutRecipeLines(f.ctx, lineID, g.ID, []LineInput{{MaterialTypeID: velcro.ID, QtyPerMat: 750}}, f.a)
	if err != nil || *rg2.RecipeID != *rg.RecipeID || len(rg2.Lines) != 1 || rg2.Lines[0].QtyPerMat != 750 {
		t.Fatalf("replace recipe: %+v, %v", rg2, err)
	}

	// Overrides: 0 allowed, negative not, unknown car 404.
	ov, err := f.s.PutOverrides(f.ctx, carID, []LineInput{{MaterialTypeID: velcro.ID, QtyPerMat: 0}, {MaterialTypeID: sheet.ID, VariantID: &w60.ID, QtyPerMat: 2900}}, f.a)
	if err != nil || len(ov.Lines) != 2 {
		t.Fatalf("put overrides: %+v, %v", ov, err)
	}
	_, err = f.s.PutOverrides(f.ctx, carID, []LineInput{{MaterialTypeID: velcro.ID, QtyPerMat: -1}}, f.a)
	is(t, "override qty < 0", err, ErrInvalid)
	_, err = f.s.GetOverrides(f.ctx, 999999)
	is(t, "overrides of unknown car", err, ErrNotFound)
	if ov, err = f.s.PutOverrides(f.ctx, carID, []LineInput{}, f.a); err != nil || len(ov.Lines) != 0 {
		t.Fatalf("clear overrides: %+v, %v", ov, err)
	}
}
