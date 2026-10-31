package batch

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Consumption engine DB tests (C1b). Each test builds an isolated fixture — its own
// product line, consumption groups, material types, recipe, cars and lots — so seed
// stock is never drawn, and removes it afterwards. Skipped without DATABASE_URL.

type matFixture struct {
	t        *testing.T
	ctx      context.Context
	pool     *pgxpool.Pool
	s        *Service
	adminID  uuid.UUID
	cutterID uuid.UUID

	sheet, velcro, piping, thread int // material type ids
	w54, w60                      int // sheet variants
	car, carNoRecipe              int
	sOld, sRoll, vA, vB, pLot     uuid.UUID // lots
	names                         map[int]string
}

const ip = "127.0.0.1"

func newMatFixture(t *testing.T) *matFixture {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	f := &matFixture{t: t, ctx: ctx, pool: pool, s: NewService(pool, t.TempDir()), names: map[int]string{}}
	t.Cleanup(pool.Close)

	one := func(dst any, q string, args ...any) {
		t.Helper()
		if err := pool.QueryRow(ctx, q, args...).Scan(dst); err != nil {
			t.Fatalf("%s: %v", strings.Fields(q)[0:3], err)
		}
	}
	one(&f.adminID, `SELECT id FROM users LIMIT 1`)
	one(&f.cutterID, `SELECT id FROM workers WHERE station = 'cutter' AND is_active LIMIT 1`)

	sfx := fmt.Sprintf("%d", time.Now().UnixNano())
	var lineID, groupID, groupNoRecipe, recipeID, brandID int
	one(&lineID, `INSERT INTO product_lines (code, name) VALUES ($1, $1) RETURNING id`, "T1B-"+sfx)
	one(&groupID, `INSERT INTO consumption_groups (name) VALUES ($1) RETURNING id`, "T1B "+sfx)
	one(&groupNoRecipe, `INSERT INTO consumption_groups (name) VALUES ($1) RETURNING id`, "T1B none "+sfx)
	mkType := func(code, unit string, variants bool) int {
		var id int
		one(&id, `INSERT INTO material_types (code, name, unit, has_variants) VALUES ($1, $2, $3, $4) RETURNING id`,
			code+"-"+sfx, "T "+code, unit, variants)
		f.names[id] = "T " + code
		return id
	}
	f.sheet = mkType("SHEET", "m", true)
	f.velcro = mkType("VELCRO", "m", false)
	f.piping = mkType("PIPING", "m", false)
	f.thread = mkType("THREAD", "spool", false)
	one(&f.w54, `INSERT INTO material_variants (material_type_id, name, specs) VALUES ($1, '54″', '{"width_in":54}') RETURNING id`, f.sheet)
	one(&f.w60, `INSERT INTO material_variants (material_type_id, name, specs) VALUES ($1, '60″', '{"width_in":60}') RETURNING id`, f.sheet)

	one(&recipeID, `INSERT INTO recipes (product_line_id, consumption_group_id) VALUES ($1, $2) RETURNING id`, lineID, groupID)
	for _, l := range []struct {
		typ int
		v   *int
		qty string
	}{{f.sheet, nil, "2.000"}, {f.sheet, &f.w60, "1.500"}, {f.velcro, nil, "0.500"}, {f.piping, nil, "3.000"}, {f.thread, nil, "0.050"}} {
		if _, err := pool.Exec(ctx, `INSERT INTO recipe_lines (recipe_id, material_type_id, variant_id, qty_per_mat) VALUES ($1, $2, $3, $4::numeric)`,
			recipeID, l.typ, l.v, l.qty); err != nil {
			t.Fatal(err)
		}
	}

	one(&brandID, `SELECT id FROM car_brands LIMIT 1`)
	mkCar := func(name string, group int) int {
		var id int
		one(&id, `INSERT INTO car_models (brand_id, name, size_class, pieces_per_set, product_line_id, consumption_group_id)
		          VALUES ($1, $2, 'medium', 4, $3, $4) RETURNING id`, brandID, name+" "+sfx, lineID, group)
		return id
	}
	f.car = mkCar("T1B car", groupID)
	f.carNoRecipe = mkCar("T1B car no recipe", groupNoRecipe)
	// Car doesn't use thread (override 0).
	if _, err := pool.Exec(ctx, `INSERT INTO car_material_overrides (car_model_id, material_type_id, qty_per_mat) VALUES ($1, $2, 0)`, f.car, f.thread); err != nil {
		t.Fatal(err)
	}

	mkLot := func(code string, typ int, variant *int, qty string, age time.Duration) uuid.UUID {
		var id uuid.UUID
		one(&id, `
			WITH l AS (
			  INSERT INTO material_lots (lot_code, color, qty_received, qty_remaining, material_type_id, variant_id, received_at)
			  VALUES ($1, 'Test', $2::numeric, $2::numeric, $3, $4, NOW() - $5::interval) RETURNING id, material_type_id, variant_id, qty_received)
			, m AS (INSERT INTO material_movements (lot_id, material_type_id, variant_id, kind, qty, reason)
			        SELECT id, material_type_id, variant_id, 'receive', qty_received, 'test' FROM l)
			SELECT id FROM l`, code+"-"+sfx, qty, typ, variant, fmt.Sprintf("%d seconds", int(age.Seconds())))
		return id
	}
	f.sOld = mkLot("S-OLD", f.sheet, &f.w54, "100", 48*time.Hour)
	f.sRoll = mkLot("S-ROLL", f.sheet, &f.w60, "100", 24*time.Hour)
	f.vA = mkLot("V-A", f.velcro, nil, "1", 48*time.Hour)
	f.vB = mkLot("V-B", f.velcro, nil, "10", 24*time.Hour)
	f.pLot = mkLot("P", f.piping, nil, "1", 24*time.Hour)

	types := []int{f.sheet, f.velcro, f.piping, f.thread}
	t.Cleanup(func() {
		for _, q := range []struct {
			sql  string
			args []any
		}{
			{`DELETE FROM batches WHERE car_model_id = ANY($1)`, []any{[]int{f.car, f.carNoRecipe}}},
			{`DELETE FROM material_movements WHERE material_type_id = ANY($1)`, []any{types}},
			{`DELETE FROM material_lots WHERE material_type_id = ANY($1)`, []any{types}},
			{`DELETE FROM recipes WHERE product_line_id = $1`, []any{lineID}},
			{`DELETE FROM car_models WHERE id = ANY($1)`, []any{[]int{f.car, f.carNoRecipe}}},
			{`DELETE FROM consumption_groups WHERE id = ANY($1)`, []any{[]int{groupID, groupNoRecipe}}},
			{`DELETE FROM product_lines WHERE id = $1`, []any{lineID}},
			{`DELETE FROM material_variants WHERE material_type_id = ANY($1)`, []any{types}},
			{`DELETE FROM material_types WHERE id = ANY($1)`, []any{types}},
		} {
			if _, err := pool.Exec(ctx, q.sql, q.args...); err != nil {
				t.Errorf("cleanup %q: %v", q.sql, err)
			}
		}
	})
	t.Cleanup(f.assertLedger) // runs first (LIFO): invariant must hold after the test
	return f
}

func (f *matFixture) batch(car, qty int, roll *uuid.UUID) uuid.UUID {
	f.t.Helper()
	in := CreateInput{CarModelID: car, Quantity: qty}
	if roll != nil {
		r := roll.String()
		in.RollID = &r
	}
	b, err := f.s.Create(f.ctx, in, f.adminID, "owner", ip)
	if err != nil {
		f.t.Fatalf("create batch: %v", err)
	}
	return b.ID
}

func (f *matFixture) cut(batchID uuid.UUID, n int) {
	f.t.Helper()
	if err := f.s.StartPhase(f.ctx, batchID, f.cutterID, "cutter", ip); err != nil {
		f.t.Fatalf("start cutting: %v", err)
	}
	if err := f.s.CompletePhase(f.ctx, batchID, f.cutterID, "cutter", n, "", ip); err != nil {
		f.t.Fatalf("complete cutting: %v", err)
	}
}

type planRow struct{ typ, variant, source, qty, planned, note string }

func (f *matFixture) plan(batchID uuid.UUID) map[string][]planRow {
	f.t.Helper()
	rows, err := f.pool.Query(f.ctx, `
		SELECT t.name, COALESCE(v.name, ''), p.source, COALESCE(p.qty_per_mat::text, ''), COALESCE(p.planned_qty::text, ''), COALESCE(p.note, '')
		FROM batch_material_plan p JOIN material_types t ON t.id = p.material_type_id
		LEFT JOIN material_variants v ON v.id = p.variant_id
		WHERE p.batch_id = $1 ORDER BY p.created_at, t.id`, batchID)
	if err != nil {
		f.t.Fatal(err)
	}
	defer rows.Close()
	out := map[string][]planRow{}
	for rows.Next() {
		var r planRow
		if err := rows.Scan(&r.typ, &r.variant, &r.source, &r.qty, &r.planned, &r.note); err != nil {
			f.t.Fatal(err)
		}
		out[r.typ] = append(out[r.typ], r)
	}
	return out
}

// moves returns "LOT:qty" per consume movement of the batch for a type ("SHORT" = shortfall), in insert order.
func (f *matFixture) moves(batchID uuid.UUID, typ int) []string {
	f.t.Helper()
	rows, err := f.pool.Query(f.ctx, `
		SELECT COALESCE(split_part(l.lot_code, '-', 1) || CASE WHEN l.lot_code LIKE 'S-%' OR l.lot_code LIKE 'V-%' THEN '-' || split_part(l.lot_code, '-', 2) ELSE '' END, 'SHORT'),
		       m.qty::text
		FROM material_movements m LEFT JOIN material_lots l ON l.id = m.lot_id
		WHERE m.batch_id = $1 AND m.material_type_id = $2 AND m.kind = 'consume'
		ORDER BY m.created_at, m.id`, batchID, typ)
	if err != nil {
		f.t.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var lot, qty string
		if err := rows.Scan(&lot, &qty); err != nil {
			f.t.Fatal(err)
		}
		out = append(out, lot+":"+qty)
	}
	return out
}

func (f *matFixture) remaining(lot uuid.UUID) string {
	f.t.Helper()
	var s string
	if err := f.pool.QueryRow(f.ctx, `SELECT qty_remaining::text FROM material_lots WHERE id = $1`, lot).Scan(&s); err != nil {
		f.t.Fatal(err)
	}
	return s
}

func (f *matFixture) notes(batchID uuid.UUID) string {
	f.t.Helper()
	var s string
	if err := f.pool.QueryRow(f.ctx, `SELECT COALESCE(notes, '') FROM batches WHERE id = $1`, batchID).Scan(&s); err != nil {
		f.t.Fatal(err)
	}
	return s
}

// assertLedger: lot qty_remaining = SUM(movements) for EVERY lot in the DB.
func (f *matFixture) assertLedger() {
	var bad int
	if err := f.pool.QueryRow(f.ctx, `
		SELECT COUNT(*) FROM (
		  SELECT l.id FROM material_lots l LEFT JOIN material_movements m ON m.lot_id = l.id
		  GROUP BY l.id HAVING l.qty_remaining <> COALESCE(SUM(m.qty), 0)) x`).Scan(&bad); err != nil {
		f.t.Fatal(err)
	}
	if bad != 0 {
		f.t.Errorf("ledger invariant broken: %d lot(s) with qty_remaining <> SUM(movements)", bad)
	}
}

func eq(t *testing.T, what string, got, want any) {
	t.Helper()
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Errorf("%s = %v, want %v", what, got, want)
	}
}

// One cut of 4 mats on the 60″ roll exercises: roll-covered type + variant quantity,
// FIFO across two lots, shortfall, override 0. Plus low-stock / shortfall stats.
func TestConsumeOneCut(t *testing.T) {
	f := newMatFixture(t)
	b := f.batch(f.car, 4, &f.sRoll)
	f.cut(b, 4)
	p := f.plan(b)

	// Roll covers the sheet type: drawn from the 60″ roll only, although S-OLD is older. 60″ line = 1.5/mat.
	eq(t, "sheet moves", f.moves(b, f.sheet), []string{"S-ROLL:-6.000"})
	eq(t, "sheet plan", p[f.names[f.sheet]], []planRow{{f.names[f.sheet], "60″", SourceRecipeVariant, "1.500", "6.000", ""}})
	eq(t, "S-OLD untouched", f.remaining(f.sOld), "100.000")

	// FIFO across two velcro lots: older V-A emptied, rest from V-B.
	eq(t, "velcro moves", f.moves(b, f.velcro), []string{"V-A:-1.000", "V-B:-1.000"})
	eq(t, "V-A", f.remaining(f.vA), "0.000")
	eq(t, "V-B", f.remaining(f.vB), "9.000")
	eq(t, "velcro plan source", p[f.names[f.velcro]][0].source, SourceRecipeAny)

	// Shortfall: 3/mat × 4 = 12, lot has 1 → lot empties, ONE shortfall of 11, notes.
	eq(t, "piping moves", f.moves(b, f.piping), []string{"P:-1.000", "SHORT:-11.000"})
	eq(t, "P", f.remaining(f.pLot), "0.000")
	short := "Material shortfall: " + f.names[f.piping] + " 11 m"
	eq(t, "piping plan note", p[f.names[f.piping]][0].note, short)
	if !strings.Contains(f.notes(b), short) {
		t.Errorf("batch notes %q missing %q", f.notes(b), short)
	}

	// Override 0: planned, nothing drawn.
	eq(t, "thread moves", len(f.moves(b, f.thread)), 0)
	eq(t, "thread plan", p[f.names[f.thread]], []planRow{{f.names[f.thread], "", SourceCarAny, "0.000", "0.000", ""}})

	// Every consume row carries the completion + the cutter.
	var missing int
	if err := f.pool.QueryRow(f.ctx, `SELECT COUNT(*) FROM material_movements WHERE batch_id = $1 AND (phase_log_id IS NULL OR actor_worker_id <> $2)`, b, f.cutterID).Scan(&missing); err != nil {
		t.Fatal(err)
	}
	eq(t, "movements without phase_log/actor", missing, 0)

	// Stats.
	if _, err := f.pool.Exec(f.ctx, `UPDATE material_types SET min_level = 100 WHERE id = $1`, f.velcro); err != nil {
		t.Fatal(err)
	}
	st, err := f.s.GetStats(f.ctx)
	if err != nil {
		t.Fatal(err)
	}
	if st.MaterialShortfallsOpen < 1 || st.LowStockTypes < 1 {
		t.Errorf("stats shortfalls=%d low_stock=%d, want ≥1 each", st.MaterialShortfallsOpen, st.LowStockTypes)
	}
}

// Without a roll the sheet is FIFO; V = the first lot's variant (54″, no 54″ line → "any" 2.0/mat).
func TestConsumeFIFOVariantOfFirstLot(t *testing.T) {
	f := newMatFixture(t)
	b := f.batch(f.car, 2, nil)
	f.cut(b, 2)
	eq(t, "sheet moves", f.moves(b, f.sheet), []string{"S-OLD:-4.000"})
	eq(t, "sheet plan", f.plan(b)[f.names[f.sheet]], []planRow{{f.names[f.sheet], "54″", SourceRecipeAny, "2.000", "4.000", ""}})
}

// No recipe for the car's line × group: the roll's type gets a 'none' plan row; nothing drawn.
func TestConsumeMissingRecipe(t *testing.T) {
	f := newMatFixture(t)
	b := f.batch(f.carNoRecipe, 3, &f.sRoll)
	f.cut(b, 3)
	p := f.plan(b)
	note := "No recipe quantity for " + f.names[f.sheet] + " (60″)"
	eq(t, "plan", p, map[string][]planRow{f.names[f.sheet]: {{f.names[f.sheet], "60″", SourceNone, "", "", note}}})
	var n int
	if err := f.pool.QueryRow(f.ctx, `SELECT COUNT(*) FROM material_movements WHERE batch_id = $1`, b).Scan(&n); err != nil {
		t.Fatal(err)
	}
	eq(t, "movements", n, 0)
	eq(t, "roll", f.remaining(f.sRoll), "100.000")
	if !strings.Contains(f.notes(b), note) {
		t.Errorf("batch notes %q missing %q", f.notes(b), note)
	}

	// No recipe and no roll: nothing to plan, only a note.
	b2 := f.batch(f.carNoRecipe, 1, nil)
	f.cut(b2, 1)
	eq(t, "plan (no roll)", len(f.plan(b2)), 0)
	if !strings.Contains(f.notes(b2), "Materials not recorded") {
		t.Errorf("batch notes %q missing 'Materials not recorded'", f.notes(b2))
	}
}

// Short cut 2 of 4 → re-cut → 2: two completions, two plan rows per type, totals add up.
func TestConsumeTwoCompletions(t *testing.T) {
	f := newMatFixture(t)
	b := f.batch(f.car, 4, &f.sRoll)
	f.cut(b, 2)
	if _, err := f.s.ResolveShort(f.ctx, b, ShortRecut, "", f.adminID, ip); err != nil {
		t.Fatalf("recut: %v", err)
	}
	f.cut(b, 2)

	sheet := f.plan(b)[f.names[f.sheet]]
	eq(t, "sheet plan rows", len(sheet), 2)
	for i, r := range sheet {
		eq(t, fmt.Sprintf("sheet plan[%d]", i), r, planRow{f.names[f.sheet], "60″", SourceRecipeVariant, "1.500", "3.000", ""})
	}
	eq(t, "sheet moves", f.moves(b, f.sheet), []string{"S-ROLL:-3.000", "S-ROLL:-3.000"})
	eq(t, "roll", f.remaining(f.sRoll), "94.000")
	var completions int
	if err := f.pool.QueryRow(f.ctx, `SELECT COUNT(DISTINCT phase_log_id) FROM batch_material_plan WHERE batch_id = $1`, b).Scan(&completions); err != nil {
		t.Fatal(err)
	}
	eq(t, "distinct completions in plan", completions, 2)
}

// Re-running consumption for an existing completion fails on uq_plan_completion_type and deducts nothing.
func TestConsumeRerunSameCompletion(t *testing.T) {
	f := newMatFixture(t)
	b := f.batch(f.car, 2, &f.sRoll)
	f.cut(b, 2)
	var logID uuid.UUID
	if err := f.pool.QueryRow(f.ctx, `SELECT id FROM phase_logs WHERE batch_id = $1 AND phase = 'cutting'`, b).Scan(&logID); err != nil {
		t.Fatal(err)
	}
	before, beforeVB := f.remaining(f.sRoll), f.remaining(f.vB)
	var movesBefore int
	if err := f.pool.QueryRow(f.ctx, `SELECT COUNT(*) FROM material_movements`).Scan(&movesBefore); err != nil {
		t.Fatal(err)
	}

	tx, err := f.pool.Begin(f.ctx)
	if err != nil {
		t.Fatal(err)
	}
	err = consumeForCutting(f.ctx, tx, b, logID, 2, f.cutterID)
	_ = tx.Rollback(f.ctx)
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" || pgErr.ConstraintName != "uq_plan_completion_type" {
		t.Fatalf("rerun: want unique violation on uq_plan_completion_type, got %v", err)
	}

	var movesAfter int
	if err := f.pool.QueryRow(f.ctx, `SELECT COUNT(*) FROM material_movements`).Scan(&movesAfter); err != nil {
		t.Fatal(err)
	}
	eq(t, "roll after rerun", f.remaining(f.sRoll), before)
	eq(t, "V-B after rerun", f.remaining(f.vB), beforeVB)
	eq(t, "movement count after rerun", movesAfter, movesBefore)
}

// Concurrent cuts drawing the same lots (FIFO, all four types) must neither deadlock nor
// double-spend. Run with -race.
func TestConsumeConcurrentCuts(t *testing.T) {
	f := newMatFixture(t)
	const n, mats = 4, 3
	ids := make([]uuid.UUID, n)
	for i := range ids {
		ids[i] = f.batch(f.car, mats, nil)
		if err := f.s.StartPhase(f.ctx, ids[i], f.cutterID, "cutter", ip); err != nil {
			t.Fatalf("start %d: %v", i, err)
		}
	}

	ctx, cancel := context.WithTimeout(f.ctx, 20*time.Second)
	defer cancel()
	var wg sync.WaitGroup
	errs := make([]error, n)
	start := make(chan struct{})
	for i := range ids {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			errs[i] = f.s.CompletePhase(ctx, ids[i], f.cutterID, "cutter", mats, "", ip)
		}(i)
	}
	close(start)
	wg.Wait()
	for i, err := range errs {
		if err != nil {
			t.Errorf("cut %d: %v", i, err) // a deadlock surfaces as SQLSTATE 40P01 here
		}
	}

	// 4 cuts × 3 mats × 2.0 m (FIFO from the 54″ lot) = 24 m, all from S-OLD.
	eq(t, "S-OLD", f.remaining(f.sOld), "76.000")
	eq(t, "S-ROLL", f.remaining(f.sRoll), "100.000")
	var planned, drawn string
	if err := f.pool.QueryRow(f.ctx, `
		SELECT (SELECT SUM(planned_qty)::text FROM batch_material_plan WHERE batch_id = ANY($1) AND material_type_id = $2),
		       (SELECT (-SUM(qty))::text      FROM material_movements  WHERE batch_id = ANY($1) AND material_type_id = $2)`,
		ids, f.velcro).Scan(&planned, &drawn); err != nil {
		t.Fatal(err)
	}
	eq(t, "velcro planned", planned, "6.000") // 4 × 3 × 0.5
	eq(t, "velcro drawn (lots + shortfall)", drawn, "6.000")
}
