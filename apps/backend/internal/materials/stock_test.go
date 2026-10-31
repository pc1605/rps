package materials

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

func TestParseMilli(t *testing.T) {
	ok := map[string]Milli{"0": 0, "12": 12000, "12.5": 12500, "0.125": 125, "-3.25": -3250, "007.10": 7100, "999999999.999": MaxMilli}
	for in, want := range ok {
		got, err := ParseMilli(in)
		if err != nil || got != want {
			t.Errorf("ParseMilli(%q) = %d, %v; want %d", in, got, err, want)
		}
	}
	for _, in := range []string{"", "1.2345", "1e3", "abc", ".5", "5.", "1000000000", "--1", "1,5", `"5"`} {
		if _, err := ParseMilli(in); err == nil {
			t.Errorf("ParseMilli(%q) accepted, want error", in)
		}
	}
	var m struct {
		Q Milli `json:"q"`
	}
	if err := json.Unmarshal([]byte(`{"q": 2.75}`), &m); err != nil || m.Q != 2750 {
		t.Errorf("unmarshal 2.75 = %d, %v", m.Q, err)
	}
	if err := json.Unmarshal([]byte(`{"q": 0.1234}`), &m); err == nil {
		t.Error("unmarshal 0.1234 accepted")
	}
	if b, _ := json.Marshal(struct{ Q Milli }{12500}); string(b) != `{"Q":12.5}` {
		t.Errorf("marshal = %s", b)
	}
}

type stockFx struct {
	t    *testing.T
	ctx  context.Context
	pool *pgxpool.Pool
	s    *Service
	a    Actor
	sfx  string
}

func newStockFx(t *testing.T) *stockFx {
	pool := testutil.DB(t)
	f := &stockFx{t: t, ctx: context.Background(), pool: pool, s: NewService(pool), sfx: fmt.Sprint(time.Now().UnixNano() % 1e12)}
	if err := pool.QueryRow(f.ctx, `SELECT id FROM users LIMIT 1`).Scan(&f.a.UserID); err != nil {
		t.Fatal(err)
	}
	f.a.Role, f.a.IP = "owner", "127.0.0.1"
	t.Cleanup(func() {
		// Everything this test created hangs off types whose code ends with the suffix.
		for _, q := range []string{
			`DELETE FROM material_movements WHERE material_type_id IN (SELECT id FROM material_types WHERE code LIKE '%-' || $1)`,
			`DELETE FROM material_lots WHERE material_type_id IN (SELECT id FROM material_types WHERE code LIKE '%-' || $1)`,
			`DELETE FROM material_variants WHERE material_type_id IN (SELECT id FROM material_types WHERE code LIKE '%-' || $1)`,
			`DELETE FROM material_types WHERE code LIKE '%-' || $1`,
		} {
			if _, err := pool.Exec(f.ctx, q, f.sfx); err != nil {
				t.Errorf("cleanup: %v", err)
			}
		}
	})
	return f
}

func sp(s string) *string { return &s }
func bp(b bool) *bool     { return &b }
func mp(m Milli) *Milli   { return &m }

func (f *stockFx) typ(code, unit string, variants bool) *MaterialType {
	f.t.Helper()
	mt, err := f.s.CreateType(f.ctx, TypeInput{Code: sp(code + "-" + f.sfx), Name: sp("T " + code), Unit: sp(unit), HasVariants: bp(variants)}, f.a)
	if err != nil {
		f.t.Fatalf("create type: %v", err)
	}
	return mt
}

func (f *stockFx) ledgerOK() {
	f.t.Helper()
	var bad int
	if err := f.pool.QueryRow(f.ctx, `SELECT COUNT(*) FROM (SELECT l.id FROM material_lots l LEFT JOIN material_movements m ON m.lot_id = l.id
		GROUP BY l.id HAVING l.qty_remaining <> COALESCE(SUM(m.qty), 0)) x`).Scan(&bad); err != nil || bad != 0 {
		f.t.Errorf("ledger drift on %d lot(s) (%v)", bad, err)
	}
}

func is(t *testing.T, what string, err, want error) {
	t.Helper()
	if !errors.Is(err, want) {
		t.Errorf("%s: got %v, want %v", what, err, want)
	}
}

func TestTypesAndVariants(t *testing.T) {
	f := newStockFx(t)
	sheet := f.typ("SHEET", "m", true)
	if sheet.Code != "SHEET-"+f.sfx || sheet.Unit != "m" || !sheet.HasVariants || !sheet.IsActive {
		t.Fatalf("created type = %+v", sheet)
	}
	_, err := f.s.CreateType(f.ctx, TypeInput{Code: sp("sheet-" + f.sfx), Name: sp("dup"), Unit: sp("m")}, f.a)
	is(t, "duplicate code (case-insensitive via upper)", err, ErrDuplicate)
	_, err = f.s.CreateType(f.ctx, TypeInput{Code: sp("X-" + f.sfx), Name: sp("x"), Unit: sp("litre")}, f.a)
	is(t, "bad unit", err, ErrInvalid)

	w60, err := f.s.CreateVariant(f.ctx, sheet.ID, VariantInput{Name: sp("60″"), Specs: rawp(`{"width_in":60}`)}, f.a)
	if err != nil {
		t.Fatalf("create variant: %v", err)
	}
	_, err = f.s.CreateVariant(f.ctx, sheet.ID, VariantInput{Name: sp("bad"), Specs: rawp(`[1,2]`)}, f.a)
	is(t, "specs not an object", err, ErrInvalid)
	_, err = f.s.CreateVariant(f.ctx, sheet.ID, VariantInput{Name: sp("60″")}, f.a)
	is(t, "duplicate variant", err, ErrDuplicate)
	plain := f.typ("PLAIN", "pcs", false)
	_, err = f.s.CreateVariant(f.ctx, plain.ID, VariantInput{Name: sp("x")}, f.a)
	is(t, "variant on a type without variants", err, ErrInvalid)

	_, err = f.s.UpdateType(f.ctx, sheet.ID, TypeInput{HasVariants: bp(false)}, f.a)
	is(t, "has_variants=false with an active variant", err, ErrHasActiveVariants)
	if _, err := f.s.UpdateVariant(f.ctx, w60.ID, VariantInput{IsActive: bp(false)}, f.a); err != nil {
		t.Fatal(err)
	}
	if _, err := f.s.Receive(f.ctx, ReceiveInput{MaterialTypeID: plain.ID, LotCode: "L-" + f.sfx, Color: "Black", Qty: 5000}, f.a); err != nil {
		t.Fatalf("receive: %v", err)
	}
	if _, err := f.s.UpdateType(f.ctx, sheet.ID, TypeInput{HasVariants: bp(false)}, f.a); err != nil {
		t.Errorf("has_variants=false once variants inactive and unused: %v", err)
	}
	_, err = f.s.UpdateType(f.ctx, plain.ID, TypeInput{Unit: sp("kg")}, f.a)
	is(t, "unit change after movements", err, ErrUnitLocked)
	upd, err := f.s.UpdateType(f.ctx, plain.ID, TypeInput{MinLevel: Opt[Milli]{Set: true, Value: mp(10000)}}, f.a)
	if err != nil || upd.MinLevel == nil || *upd.MinLevel != 10000 || !upd.IsLow || upd.StockRemaining != 5000 {
		t.Errorf("min_level → is_low: %+v, %v", upd, err)
	}
	upd, err = f.s.UpdateType(f.ctx, plain.ID, TypeInput{MinLevel: Opt[Milli]{Set: true}}, f.a)
	if err != nil || upd.MinLevel != nil || upd.IsLow {
		t.Errorf("min_level null clears: %+v, %v", upd, err)
	}
	f.ledgerOK()
}

func rawp(s string) *json.RawMessage { r := json.RawMessage(s); return &r }

func TestLotMovements(t *testing.T) {
	f := newStockFx(t)
	sheet := f.typ("SHEET", "m", true)
	w54, _ := f.s.CreateVariant(f.ctx, sheet.ID, VariantInput{Name: sp("54″")}, f.a)
	w60, _ := f.s.CreateVariant(f.ctx, sheet.ID, VariantInput{Name: sp("60″")}, f.a)
	other := f.typ("OTHER", "m", false)

	_, err := f.s.Receive(f.ctx, ReceiveInput{MaterialTypeID: sheet.ID, LotCode: "R-" + f.sfx, Color: "Black", Qty: 50000}, f.a)
	is(t, "receive without required variant", err, ErrInvalid)
	_, err = f.s.Receive(f.ctx, ReceiveInput{MaterialTypeID: other.ID, VariantID: &w54.ID, LotCode: "R-" + f.sfx, Color: "Black", Qty: 50000}, f.a)
	is(t, "receive with variant on a type without variants", err, ErrInvalid)
	_, err = f.s.Receive(f.ctx, ReceiveInput{MaterialTypeID: sheet.ID, VariantID: &w54.ID, LotCode: "R-" + f.sfx, Color: "Black", Qty: 0}, f.a)
	is(t, "receive qty 0", err, ErrInvalid)

	lot, err := f.s.Receive(f.ctx, ReceiveInput{MaterialTypeID: sheet.ID, VariantID: &w54.ID, LotCode: "R-" + f.sfx,
		Color: "Black", Qty: 50000, UnitCost: mp(180500), Supplier: sp("Shah Rexine")}, f.a)
	if err != nil {
		t.Fatalf("receive: %v", err)
	}
	if lot.QtyRemaining != 50000 || lot.QtyReceived != 50000 || *lot.UnitCost != 180500 || *lot.VariantName != "54″" || lot.LastMovementAt == nil {
		t.Fatalf("received lot = %+v", lot)
	}
	_, err = f.s.Receive(f.ctx, ReceiveInput{MaterialTypeID: sheet.ID, VariantID: &w54.ID, LotCode: "R-" + f.sfx, Color: "x", Qty: 1}, f.a)
	is(t, "duplicate lot code", err, ErrDuplicate)

	// Re-classify before consumption: allowed, opening movement follows.
	lot, err = f.s.PatchLot(f.ctx, lot.ID, LotPatch{VariantID: Opt[int]{Set: true, Value: &w60.ID}, Note: Opt[string]{Set: true, Value: sp("relabelled")}}, f.a)
	if err != nil || *lot.VariantName != "60″" || *lot.Note != "relabelled" {
		t.Fatalf("reclassify: %+v, %v", lot, err)
	}
	var mvVariant int
	if err := f.pool.QueryRow(f.ctx, `SELECT variant_id FROM material_movements WHERE lot_id = $1 AND kind = 'receive'`, lot.ID).Scan(&mvVariant); err != nil || mvVariant != w60.ID {
		t.Errorf("receive movement variant = %d (%v), want %d", mvVariant, err, w60.ID)
	}
	_, err = f.s.PatchLot(f.ctx, lot.ID, LotPatch{MaterialTypeID: &other.ID, VariantID: Opt[int]{Set: true, Value: &w60.ID}}, f.a)
	is(t, "reclassify to a type that doesn't own the variant", err, ErrInvalid)

	// Adjust / waste / return.
	_, err = f.s.Adjust(f.ctx, lot.ID, AdjustInput{NewRemaining: mp(50000), Reason: "count"}, f.a)
	is(t, "adjust to the same value", err, ErrInvalid)
	_, err = f.s.Adjust(f.ctx, lot.ID, AdjustInput{NewRemaining: mp(48500)}, f.a)
	is(t, "adjust without reason", err, ErrInvalid)
	if lot, err = f.s.Adjust(f.ctx, lot.ID, AdjustInput{NewRemaining: mp(48500), Reason: "stock count"}, f.a); err != nil || lot.QtyRemaining != 48500 {
		t.Fatalf("adjust: %+v, %v", lot, err)
	}
	_, err = f.s.Waste(f.ctx, lot.ID, QtyReasonInput{Qty: 48501, Reason: "torn"}, f.a)
	is(t, "waste above remaining", err, ErrInvalid)
	if lot, err = f.s.Waste(f.ctx, lot.ID, QtyReasonInput{Qty: 1250, Reason: "torn edge"}, f.a); err != nil || lot.QtyRemaining != 47250 {
		t.Fatalf("waste: %+v, %v", lot, err)
	}
	if lot, err = f.s.Return(f.ctx, lot.ID, QtyReasonInput{Qty: 750, Reason: "offcut back"}, f.a); err != nil || lot.QtyRemaining != 48000 {
		t.Fatalf("return: %+v, %v", lot, err)
	}

	// After waste/return the type/variant is frozen; descriptive fields still editable.
	_, err = f.s.PatchLot(f.ctx, lot.ID, LotPatch{VariantID: Opt[int]{Set: true, Value: &w54.ID}}, f.a)
	is(t, "reclassify after waste", err, ErrLotHasConsumption)
	if lot, err = f.s.PatchLot(f.ctx, lot.ID, LotPatch{IsActive: bp(false), Supplier: Opt[string]{Set: true}}, f.a); err != nil || lot.IsActive || lot.Supplier != nil {
		t.Fatalf("patch descriptive: %+v, %v", lot, err)
	}

	// Ledger, newest first, paginated.
	p1, err := f.s.ListMovements(f.ctx, MovementFilter{LotID: &lot.ID, Limit: 2})
	if err != nil || len(p1.Items) != 2 || p1.NextCursor == nil {
		t.Fatalf("page 1: %+v, %v", p1, err)
	}
	p2, err := f.s.ListMovements(f.ctx, MovementFilter{LotID: &lot.ID, Limit: 2, Cursor: *p1.NextCursor})
	if err != nil || len(p2.Items) != 2 || p2.NextCursor != nil {
		t.Fatalf("page 2: %+v, %v", p2, err)
	}
	kinds := []string{p1.Items[0].Kind, p1.Items[1].Kind, p2.Items[0].Kind, p2.Items[1].Kind}
	if fmt.Sprint(kinds) != "[return waste adjust receive]" {
		t.Errorf("ledger order = %v", kinds)
	}
	if p1.Items[0].ActorUserName == nil || p1.Items[0].LotCode == nil || p1.Items[0].Unit != "m" {
		t.Errorf("movement row missing joins: %+v", p1.Items[0])
	}
	_, err = f.s.ListMovements(f.ctx, MovementFilter{Cursor: "garbage"})
	is(t, "bad cursor", err, ErrInvalid)

	lots, err := f.s.ListLots(f.ctx, &sheet.ID, bp(false), false)
	if err != nil || len(lots) != 1 || lots[0].ID != lot.ID {
		t.Errorf("list lots type+inactive: %d lots, %v", len(lots), err)
	}
	f.ledgerOK()
}
