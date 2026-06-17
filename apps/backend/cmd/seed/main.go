package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

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
	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
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
	fmt.Println("✓ owner seeded — owner@ambika.local / admin123")

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
				VALUES ($1, $2, $3, $4, $5)
				ON CONFLICT (brand_id, name) DO UPDATE
				SET size_class     = EXCLUDED.size_class,
				    pieces_per_set = EXCLUDED.pieces_per_set,
				    piece_groups   = EXCLUDED.piece_groups
			`, brandID, m.name, m.size, m.piecesPerSet, m.pieceGroups)
			if err != nil {
				panic(err)
			}
		}
	}
	fmt.Println("✓ car brands + models seeded")

	// ───── Rexine rolls ─────
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
		_, err = pool.Exec(ctx, `
			INSERT INTO raw_materials (roll_code, color, total_meters, remaining_meters)
			VALUES ($1, $2, $3, $3)
			ON CONFLICT (roll_code) DO NOTHING
		`, r.code, r.color, r.total)
		if err != nil {
			panic(err)
		}
	}
	fmt.Println("✓ rexine rolls seeded")

	fmt.Println("\n✓ all seed data ready")
}