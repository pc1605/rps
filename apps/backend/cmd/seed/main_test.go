package main

import "testing"

// The owner's seed password: from SEED_ADMIN_PASSWORD when set; the demo one only outside production.
func TestAdminPassword(t *testing.T) {
	cases := []struct {
		name, value, env string
		want             string
		wantFromEnv      bool
		wantErr          bool
	}{
		{"development without a value uses the demo password", "", "development", demoAdminPassword, false, false},
		{"no ENV at all counts as development", "", "", demoAdminPassword, false, false},
		{"production without a value is refused", "", "production", "", false, true},
		{"production with a value uses it", "a-long-real-password", "production", "a-long-real-password", true, false},
		{"development with a value uses it", "a-long-real-password", "development", "a-long-real-password", true, false},
		{"a short value is refused", "short", "production", "", false, true},
		{"8 characters are refused", "abcdefgh", "production", "", false, true},
		{"9 characters are enough", "abcdefghi", "production", "abcdefghi", true, false},
		{"the demo password as the value is refused", demoAdminPassword, "production", "", false, true},
	}
	for _, tc := range cases {
		got, fromEnv, err := adminPassword(tc.value, tc.env)
		if (err != nil) != tc.wantErr || got != tc.want || fromEnv != tc.wantFromEnv {
			t.Errorf("%s: got (%q, %v, %v)", tc.name, got, fromEnv, err)
		}
	}
}
