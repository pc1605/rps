package stock

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TestRollLedger pins migration 015's rule on the pre-C2 roll endpoints:
// qty_remaining always equals SUM(material_movements.qty) for the lot.
// Runs against DATABASE_URL (skipped otherwise); cleans up its lot.
func TestRollLedger(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	s := NewService(pool)

	var adminID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM users LIMIT 1`).Scan(&adminID); err != nil {
		t.Fatal(err)
	}

	code := fmt.Sprintf("T-LEDGER-%d", time.Now().UnixNano())
	r, err := s.Create(ctx, CreateRollInput{RollCode: code, Color: "Test Grey", TotalMeters: 50}, adminID, "owner", "127.0.0.1")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(ctx, `DELETE FROM material_movements WHERE lot_id = $1`, r.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM material_lots WHERE id = $1`, r.ID)
	}()

	ledger := func() (remaining, sum float64, kinds string) {
		t.Helper()
		if err := pool.QueryRow(ctx, `
			SELECT l.qty_remaining::float8, COALESCE(SUM(m.qty), 0)::float8,
			       COALESCE(string_agg(m.kind::text, ',' ORDER BY m.created_at, m.kind), '')
			FROM material_lots l LEFT JOIN material_movements m ON m.lot_id = l.id
			WHERE l.id = $1 GROUP BY l.id`, r.ID).Scan(&remaining, &sum, &kinds); err != nil {
			t.Fatal(err)
		}
		return
	}

	// Default type is Rexine R.
	var typeCode string
	if err := pool.QueryRow(ctx, `SELECT t.code FROM material_lots l JOIN material_types t ON t.id = l.material_type_id WHERE l.id = $1`, r.ID).Scan(&typeCode); err != nil {
		t.Fatal(err)
	}
	if typeCode != DefaultRollTypeCode {
		t.Errorf("default type = %s, want %s", typeCode, DefaultRollTypeCode)
	}

	if rem, sum, kinds := ledger(); rem != 50 || sum != 50 || kinds != "receive" {
		t.Fatalf("after create: remaining=%v sum=%v kinds=%q, want 50/50/receive", rem, sum, kinds)
	}

	// Manual correction → one adjust movement for the difference (incl. a 3-decimal value).
	rem := 37.125
	if _, err := s.Update(ctx, r.ID, UpdateRollInput{RemainingMeters: &rem}, adminID, "owner", "127.0.0.1"); err != nil {
		t.Fatalf("update remaining: %v", err)
	}
	if got, sum, kinds := ledger(); got != 37.125 || sum != 37.125 || kinds != "receive,adjust" {
		t.Fatalf("after correction: remaining=%v sum=%v kinds=%q", got, sum, kinds)
	}

	// Patch without a remaining change (colour, deactivate) writes no movement.
	color, inactive := "Test Blue", false
	if _, err := s.Update(ctx, r.ID, UpdateRollInput{Color: &color, IsActive: &inactive}, adminID, "owner", "127.0.0.1"); err != nil {
		t.Fatalf("update colour: %v", err)
	}
	if got, sum, kinds := ledger(); got != sum || kinds != "receive,adjust" {
		t.Fatalf("after colour change: remaining=%v sum=%v kinds=%q, want no new movement", got, sum, kinds)
	}

	// List (pre-C2 /stock/rolls) reads the renamed table and keeps the JSON shape.
	rolls, err := s.List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	found := false
	for _, x := range rolls {
		if x.ID == r.ID {
			found = x.RollCode == code && x.TotalMeters == 50 && x.RemainingMeters == 37.125 && !x.IsActive
		}
	}
	if !found {
		t.Errorf("list: test lot missing or wrong fields")
	}

	// Unknown material type is rejected.
	bad := -1
	if _, err := s.Create(ctx, CreateRollInput{RollCode: code + "-X", Color: "x", TotalMeters: 1, MaterialTypeID: &bad}, adminID, "owner", "127.0.0.1"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad type: want ErrInvalidInput, got %v", err)
	}
}
