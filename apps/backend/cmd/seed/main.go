package main

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

// demoAdminPassword is the owner's password on development and test databases. It is public
// (docs, Postman), so a production seed must bring its own in SEED_ADMIN_PASSWORD.
const (
	demoAdminPassword    = "admin123"
	minAdminPasswordSize = 12
)

// adminPassword picks the owner's password: SEED_ADMIN_PASSWORD when set, else the demo one —
// which production refuses. fromEnv tells the caller not to print it.
func adminPassword(fromEnvValue, env string) (password string, fromEnv bool, err error) {
	if fromEnvValue != "" {
		if len(fromEnvValue) < minAdminPasswordSize || fromEnvValue == demoAdminPassword {
			return "", false, fmt.Errorf("SEED_ADMIN_PASSWORD must be at least %d characters", minAdminPasswordSize)
		}
		return fromEnvValue, true, nil
	}
	if env == "production" {
		return "", false, errors.New("ENV=production: set SEED_ADMIN_PASSWORD — refusing to seed the demo password")
	}
	return demoAdminPassword, false, nil
}

func main() {
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load(".env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		fmt.Println("DATABASE_URL not set")
		os.Exit(1)
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		panic(err)
	}
	defer pool.Close()
	ctx := context.Background()

	// ───── Owner account ─────
	password, fromEnv, err := adminPassword(os.Getenv("SEED_ADMIN_PASSWORD"), os.Getenv("ENV"))
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO users (name, email, password_hash, role)
		VALUES ('Owner', 'owner@ambika.local', $1, 'owner')
		ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
	`, string(hash))
	if err != nil {
		panic(err)
	}
	if fromEnv {
		fmt.Println("✓ owner seeded — owner@ambika.local / password from SEED_ADMIN_PASSWORD")
	} else {
		fmt.Println("✓ owner seeded — owner@ambika.local / " + demoAdminPassword + " (demo password, development only)")
	}

	// Production gets the owner account only — the brands, models and rolls below are demo data.
	// The real catalogue is entered in the admin web.
	if os.Getenv("ENV") == "production" {
		fmt.Println("\n✓ production: owner only, no demo data")
		return
	}

	// ───── Car brands + models ─────
	// Upsert brands, capture ids, then upsert their models.
	brands := map[string][]struct {
		name         string
		size         string
		piecesPerSet int
		pieceGroups  int
	}{
		"Maruti Suzuki": {
			{"Baleno", "small", 5, 2},
			{"Swift", "small", 5, 2},
			{"Ertiga", "large", 7, 3},
		},
		"Hyundai": {
			{"Creta", "medium", 5, 2},
			{"i20", "small", 5, 2},
		},
		"Tata": {
			{"Nexon", "medium", 5, 2},
		},
	}

	for brandName, models := range brands {
		var brandID int
		err = pool.QueryRow(ctx, `
			INSERT INTO car_brands (name) VALUES ($1)
			ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
			RETURNING id
		`, brandName).Scan(&brandID)
		if err != nil {
			panic(err)
		}

		for _, m := range models {
			_, err = pool.Exec(ctx, `
				INSERT INTO car_models (brand_id, name, size_class, pieces_per_set, piece_groups)
				SELECT $1, $2, $3, $4, $5
				WHERE NOT EXISTS (
					SELECT 1 FROM car_models WHERE brand_id = $1 AND name = $2
				)
			`, brandID, m.name, m.size, m.piecesPerSet, m.pieceGroups)
			if err != nil {
				panic(err)
			}
		}
	}
	fmt.Println("✓ car brands + models seeded")

	// ───── Rexine rolls (material lots of type Rexine R, migration 015) ─────
	rolls := []struct {
		code  string
		color string
		total float64
	}{
		{"R-001", "Jet Black", 50},
		{"R-002", "Beige Tan", 40},
		{"R-003", "Coffee Brown", 30},
	}
	for _, r := range rolls {
		// Lot + its 'receive' movement in one statement: ON CONFLICT → no row → no duplicate movement.
		_, err = pool.Exec(ctx, `
			WITH lot AS (
				INSERT INTO material_lots (lot_code, color, qty_received, qty_remaining, material_type_id)
				SELECT $1, $2, $3, $3, id FROM material_types WHERE code = 'REX-R'
				ON CONFLICT (lot_code) DO NOTHING
				RETURNING id, material_type_id, qty_received
			)
			INSERT INTO material_movements (lot_id, material_type_id, kind, qty, reason)
			SELECT id, material_type_id, 'receive', qty_received, 'seed' FROM lot
		`, r.code, r.color, r.total)
		if err != nil {
			panic(err)
		}
	}
	fmt.Println("✓ rexine rolls seeded")

	fmt.Println("\n✓ all seed data ready")
}
