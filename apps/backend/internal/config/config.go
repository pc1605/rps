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
	Port             string
	Env              string
	LogLevel         string
	DatabaseURL      string
	JWTAccessSecret  string
	JWTRefreshSecret string
	JWTAccessTTL     time.Duration
	JWTRefreshTTL    time.Duration
	CORSOrigins      []string
	UploadDir        string
	FileURLSecret    string
	FileURLTTL       time.Duration
	FactoryTZ        string // IANA zone for calendar days (reports, "today")
	// LoginMaxFailures is how many failed logins one address may make per httpx.LoginWindow.
	LoginMaxFailures int
	// ProxyHeader names the request header that carries the real client address when the backend
	// runs behind a host's proxy (set at deploy; empty = use the connection's address).
	ProxyHeader string
	// FCMCredentialsFile is the Firebase service-account key (JSON) for phone notifications (N1).
	// Empty = notifications off.
	FCMCredentialsFile string
}

// IsProduction reports whether this is the deployed system (ENV=production).
func (c *Config) IsProduction() bool { return c.Env == "production" }

func Load() (*Config, error) {
	// Load .env from repo root (two levels up from apps/backend)
	_ = godotenv.Load("../../.env")
	// Also try local .env
	_ = godotenv.Load(".env")

	c := &Config{
		Port:               getEnv("PORT", "3000"),
		Env:                getEnv("ENV", "development"),
		LogLevel:           getEnv("LOG_LEVEL", "info"),
		DatabaseURL:        mustEnv("DATABASE_URL"),
		JWTAccessSecret:    mustEnv("JWT_ACCESS_SECRET"),
		JWTRefreshSecret:   mustEnv("JWT_REFRESH_SECRET"),
		CORSOrigins:        strings.Split(getEnv("CORS_ORIGINS", "http://localhost:3000"), ","),
		UploadDir:          getEnv("UPLOAD_DIR", "./uploads"),
		FileURLSecret:      getEnv("FILE_URL_SECRET", ""),
		FactoryTZ:          getEnv("FACTORY_TZ", "Asia/Kolkata"),
		ProxyHeader:        getEnv("PROXY_HEADER", ""),
		FCMCredentialsFile: getEnv("FCM_CREDENTIALS_FILE", ""),
	}

	c.LoginMaxFailures, _ = strconv.Atoi(getEnv("LOGIN_MAX_FAILURES", "10"))
	if c.LoginMaxFailures <= 0 {
		c.LoginMaxFailures = 10
	}

	accessMin, _ := strconv.Atoi(getEnv("JWT_ACCESS_TTL_MINUTES", "15"))
	refreshDays, _ := strconv.Atoi(getEnv("JWT_REFRESH_TTL_DAYS", "30"))
	c.JWTAccessTTL = time.Duration(accessMin) * time.Minute
	c.JWTRefreshTTL = time.Duration(refreshDays) * 24 * time.Hour

	fileTTLMin, _ := strconv.Atoi(getEnv("FILE_URL_TTL_MINUTES", "60"))
	if fileTTLMin <= 0 {
		fileTTLMin = 60
	}
	c.FileURLTTL = time.Duration(fileTTLMin) * time.Minute

	if len(c.JWTAccessSecret) < 32 {
		return nil, fmt.Errorf("JWT_ACCESS_SECRET must be at least 32 chars")
	}
	if len(c.JWTRefreshSecret) < 32 {
		return nil, fmt.Errorf("JWT_REFRESH_SECRET must be at least 32 chars")
	}

	if c.FileURLSecret == "" {
		if c.IsProduction() {
			return nil, fmt.Errorf("FILE_URL_SECRET is required in production")
		}
		// Dev default derived from JWT_ACCESS_SECRET
		c.FileURLSecret = c.JWTAccessSecret
	}

	// The development secrets are the placeholders in .env.example — public in the repository.
	// Production must run on its own freshly generated values.
	if c.IsProduction() {
		for name, value := range map[string]string{
			"JWT_ACCESS_SECRET":  c.JWTAccessSecret,
			"JWT_REFRESH_SECRET": c.JWTRefreshSecret,
			"FILE_URL_SECRET":    c.FileURLSecret,
		} {
			if strings.HasPrefix(value, devSecretPrefix) {
				return nil, fmt.Errorf("%s still has its development value — generate a new one for production", name)
			}
		}
		if c.JWTAccessSecret == c.JWTRefreshSecret {
			return nil, fmt.Errorf("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ in production")
		}
	}

	return c, nil
}

// devSecretPrefix starts every placeholder secret in .env.example.
const devSecretPrefix = "change-me"

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
