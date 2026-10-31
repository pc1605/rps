package materials

import (
	"errors"
	"fmt"
	"strings"
	"testing"
)

// Deleting types/groups is only for things nothing references; inactive types are not planned.
func TestDeleteAndInactive(t *testing.T) {
	f := newStockFx(t)
	ip := func(v int) *int { return &v }

	var lineID, carID int
	if err := f.pool.QueryRow(f.ctx, `INSERT INTO product_lines (code, name) VALUES ($1, $1) RETURNING id`, "TDL-"+f.sfx).Scan(&lineID); err != nil {
		t.Fatal(err)
	}
	g, err := f.s.CreateGroup(f.ctx, GroupInput{Name: sp("T del grp " + f.sfx), Sort: ip(99)}, f.a)
	if err != nil {
		t.Fatal(err)
	}
	if err := f.pool.QueryRow(f.ctx, `INSERT INTO car_models (brand_id, name, size_class, pieces_per_set, product_line_id, consumption_group_id)
		VALUES ((SELECT id FROM car_brands LIMIT 1), $1, 'medium', 4, $2, $3) RETURNING id`, "T del car "+f.sfx, lineID, g.ID).Scan(&carID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { // FK order; runs before the type cleanup registered in newStockFx
		for _, q := range []string{
			fmt.Sprintf(`DELETE FROM car_models WHERE id = %d`, carID),
			fmt.Sprintf(`DELETE FROM recipes WHERE product_line_id = %d`, lineID),
			`DELETE FROM consumption_groups WHERE name LIKE 'T del grp %'`,
			fmt.Sprintf(`DELETE FROM product_lines WHERE id = %d`, lineID),
		} {
			if _, err := f.pool.Exec(f.ctx, q); err != nil {
				t.Errorf("cleanup %q: %v", q, err)
			}
		}
	})

	// ── Types.
	unused := f.typ("UNUSED", "m", true)
	if _, err := f.s.CreateVariant(f.ctx, unused.ID, VariantInput{Name: sp("54″")}, f.a); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.s.getType(f.ctx, f.pool, unused.ID); !got.Deletable {
		t.Fatalf("fresh type not deletable: %+v", got)
	}
	if err := f.s.DeleteType(f.ctx, unused.ID, f.a); err != nil {
		t.Fatalf("delete unused type (with variant): %v", err)
	}
	_, err = f.s.getType(f.ctx, f.pool, unused.ID)
	is(t, "type after delete", err, ErrNotFound)
	is(t, "delete missing type", f.s.DeleteType(f.ctx, unused.ID, f.a), ErrNotFound)

	velcro := f.typ("VELCRO", "m", false)
	thread := f.typ("THREAD", "m", false)
	stocked := f.typ("STOCKED", "m", false)
	if _, err := f.s.PutRecipeLines(f.ctx, lineID, g.ID, []LineInput{
		{MaterialTypeID: velcro.ID, QtyPerMat: 500},
		{MaterialTypeID: thread.ID, QtyPerMat: 100},
	}, f.a); err != nil {
		t.Fatal(err)
	}
	if _, err := f.s.Receive(f.ctx, ReceiveInput{MaterialTypeID: stocked.ID, LotCode: "DL-" + f.sfx, Color: "x", Qty: 1000}, f.a); err != nil {
		t.Fatal(err)
	}
	vt, _ := f.s.getType(f.ctx, f.pool, velcro.ID)
	if vt.Deletable || vt.RecipeLines != 1 || vt.HasHistory {
		t.Errorf("type in a recipe = %+v", vt)
	}
	is(t, "delete type used by a recipe", f.s.DeleteType(f.ctx, velcro.ID, f.a), ErrTypeInUse)
	st, _ := f.s.getType(f.ctx, f.pool, stocked.ID)
	if st.Deletable || !st.HasHistory {
		t.Errorf("type with a lot = %+v", st)
	}
	is(t, "delete type with a lot", f.s.DeleteType(f.ctx, stocked.ID, f.a), ErrTypeInUse)

	// ── Inactive type: skipped by the planner (dry run and engine share BuildPlan).
	if _, err := f.s.UpdateType(f.ctx, thread.ID, TypeInput{IsActive: bp(false)}, f.a); err != nil {
		t.Fatal(err)
	}
	plan, err := BuildPlan(f.ctx, f.pool, PlanInput{CarModelID: carID, Mats: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Lines) != 1 || plan.Lines[0].MaterialTypeID != velcro.ID {
		t.Errorf("plan lines = %+v, want velcro only", plan.Lines)
	}
	if !strings.Contains(strings.Join(plan.Notes, "|"), "Skipped T THREAD") {
		t.Errorf("plan notes = %v, want an inactive skip note", plan.Notes)
	}

	// ── Groups.
	is(t, "delete group used by a car", f.s.DeleteGroup(f.ctx, g.ID, f.a), ErrGroupInUse)
	other, err := f.s.CreateGroup(f.ctx, GroupInput{Name: sp("T del grp other " + f.sfx)}, f.a)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.s.PutRecipeLines(f.ctx, lineID, other.ID, []LineInput{{MaterialTypeID: velcro.ID, QtyPerMat: 1}}, f.a); err != nil {
		t.Fatal(err)
	}
	if og, _ := f.s.getGroup(f.ctx, f.pool, other.ID); og.Deletable || og.RecipeLines != 1 {
		t.Errorf("group with recipe lines = %+v", og)
	}
	is(t, "delete group with recipe lines", f.s.DeleteGroup(f.ctx, other.ID, f.a), ErrGroupHasRecipes)
	// Clear the lines: the empty recipe header goes with the group.
	if _, err := f.s.PutRecipeLines(f.ctx, lineID, other.ID, []LineInput{}, f.a); err != nil {
		t.Fatal(err)
	}
	if err := f.s.DeleteGroup(f.ctx, other.ID, f.a); err != nil {
		t.Fatalf("delete empty group: %v", err)
	}
	_, err = f.s.getGroup(f.ctx, f.pool, other.ID)
	is(t, "group after delete", err, ErrNotFound)

	var dflt int
	if err := f.pool.QueryRow(f.ctx, `SELECT id FROM consumption_groups WHERE default_for_size IS NOT NULL LIMIT 1`).Scan(&dflt); err == nil {
		if err := f.s.DeleteGroup(f.ctx, dflt, f.a); !errors.Is(err, ErrGroupInUse) && !errors.Is(err, ErrGroupIsDefault) {
			t.Errorf("delete a size default: %v", err)
		}
	}

	var audits int
	if err := f.pool.QueryRow(f.ctx, `SELECT COUNT(*) FROM audit_log WHERE action = 'delete' AND
		((entity_type = 'material_type' AND entity_id = $1) OR (entity_type = 'consumption_group' AND entity_id = $2))`,
		fmt.Sprint(unused.ID), fmt.Sprint(other.ID)).Scan(&audits); err != nil || audits != 2 {
		t.Errorf("delete audit rows = %d (%v), want 2", audits, err)
	}
}
