package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port              string
	Env               string
	LogLevel          string
	DatabaseURL       string
	JWTAccessSecret   string
	JWTRefreshSecret  string
	JWTAccessTTL      time.Duration
	JWTRefreshTTL     time.Duration
	QRHashSecret      string
	CORSOrigins       []string
}

func Load() (*Config, error) {
	// Load .env from repo root (two levels up from apps/backend)
	_ = godotenv.Load("../../.env")
	// Also try local .env
	_ = godotenv.Load(".env")

	c := &Config{
		Port:             getEnv("PORT", "3000"),
		Env:              getEnv("ENV", "development"),
		LogLevel:         getEnv("LOG_LEVEL", "info"),
		DatabaseURL:      mustEnv("DATABASE_URL"),
		JWTAccessSecret:  mustEnv("JWT_ACCESS_SECRET"),
		JWTRefreshSecret: mustEnv("JWT_REFRESH_SECRET"),
		QRHashSecret:     getEnv("QR_HASH_SECRET", ""),
		CORSOrigins:      strings.Split(getEnv("CORS_ORIGINS", "http://localhost:3000"), ","),
	}

	accessMin, _ := strconv.Atoi(getEnv("JWT_ACCESS_TTL_MINUTES", "15"))
	refreshDays, _ := strconv.Atoi(getEnv("JWT_REFRESH_TTL_DAYS", "30"))
	c.JWTAccessTTL = time.Duration(accessMin) * time.Minute
	c.JWTRefreshTTL = time.Duration(refreshDays) * 24 * time.Hour	

	if len(c.JWTAccessSecret) < 32 {
		return nil, fmt.Errorf("JWT_ACCESS_SECRET must be at least 32 chars")
	}
	if len(c.JWTRefreshSecret) < 32 {
		return nil, fmt.Errorf("JWT_REFRESH_SECRET must be at least 32 chars")
	}

	return c, nil
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func mustEnv(key string) string {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		panic(fmt.Sprintf("required env var missing: %s", key))
	}
	return v
}