package config

import (
	"strings"
	"testing"
)

// Production refuses to start on the placeholder secrets from .env.example (they are public).
func TestProductionRefusesDevSecrets(t *testing.T) {
	const (
		realA = "8f3b1c0e5d7a49b2a6c4e1f09d2b7c35"
		realB = "1d9e4a7c2b6f48d0b3a5c8e7f1029d46"
		realC = "c7a2e9f14b0d43e8a1f6b5d3c9e80a27"
		dev   = "change-me-in-production-min-32-chars-long"
	)
	cases := []struct {
		name                  string
		env                   string
		access, refresh, file string
		wantErr               string // "" = must load
	}{
		{"development runs on the placeholders", "development", dev, dev, "", ""},
		{"production with fresh secrets", "production", realA, realB, realC, ""},
		{"production with a placeholder access secret", "production", dev, realB, realC, "JWT_ACCESS_SECRET"},
		{"production with a placeholder refresh secret", "production", realA, dev, realC, "JWT_REFRESH_SECRET"},
		{"production with a placeholder file secret", "production", realA, realB, dev, "FILE_URL_SECRET"},
		{"production without a file secret", "production", realA, realB, "", "FILE_URL_SECRET"},
		{"production with one secret used twice", "production", realA, realA, realC, "must differ"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("ENV", tc.env)
			t.Setenv("DATABASE_URL", "postgres://unused")
			t.Setenv("JWT_ACCESS_SECRET", tc.access)
			t.Setenv("JWT_REFRESH_SECRET", tc.refresh)
			t.Setenv("FILE_URL_SECRET", tc.file)
			_, err := Load()
			switch {
			case tc.wantErr == "" && err != nil:
				t.Fatalf("want it to load, got %v", err)
			case tc.wantErr != "" && (err == nil || !strings.Contains(err.Error(), tc.wantErr)):
				t.Fatalf("want an error naming %q, got %v", tc.wantErr, err)
			}
		})
	}
}
