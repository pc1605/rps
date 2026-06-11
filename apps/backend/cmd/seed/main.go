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

	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		panic(err)
	}
	defer pool.Close()

	_, err = pool.Exec(context.Background(), `
		INSERT INTO users (name, email, password_hash, role)
		VALUES ('Owner', 'owner@ambika.local', $1, 'owner')
		ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
	`, string(hash))
	if err != nil {
		panic(err)
	}

	fmt.Println("✓ owner seeded — email: owner@ambika.local, password: admin123")
}
