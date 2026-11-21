package files

import (
	"net/url"
	"strconv"
	"testing"
	"time"
)

func TestSignAndVerify(t *testing.T) {
	testSecret := "super-secret-signing-key-for-testing-purposes"
	Configure(testSecret, 30*time.Minute)

	fileName := "photo_abc123.jpg"

	t.Run("valid signature passes", func(t *testing.T) {
		q := Sign(fileName, 10*time.Minute)
		values, err := url.ParseQuery(q)
		if err != nil {
			t.Fatalf("failed to parse query: %v", err)
		}

		exp := values.Get("exp")
		sig := values.Get("sig")
		if exp == "" || sig == "" {
			t.Fatalf("expected exp and sig in query, got: %s", q)
		}

		if !Verify(fileName, exp, sig) {
			t.Errorf("expected valid signature to pass verification")
		}
	})

	t.Run("tampered name fails", func(t *testing.T) {
		q := Sign(fileName, 10*time.Minute)
		values, _ := url.ParseQuery(q)
		exp := values.Get("exp")
		sig := values.Get("sig")

		if Verify("different_file.jpg", exp, sig) {
			t.Errorf("expected verification to fail with tampered filename")
		}
	})

	t.Run("tampered exp fails", func(t *testing.T) {
		q := Sign(fileName, 10*time.Minute)
		values, _ := url.ParseQuery(q)
		exp := values.Get("exp")
		sig := values.Get("sig")

		expInt, _ := strconv.ParseInt(exp, 10, 64)
		tamperedExp := strconv.FormatInt(expInt+100, 10)

		if Verify(fileName, tamperedExp, sig) {
			t.Errorf("expected verification to fail with tampered exp")
		}
	})

	t.Run("tampered sig fails", func(t *testing.T) {
		q := Sign(fileName, 10*time.Minute)
		values, _ := url.ParseQuery(q)
		exp := values.Get("exp")
		sig := values.Get("sig")

		tamperedSig := sig
		if len(sig) > 0 {
			if sig[0] == 'a' {
				tamperedSig = "b" + sig[1:]
			} else {
				tamperedSig = "a" + sig[1:]
			}
		}

		if Verify(fileName, exp, tamperedSig) {
			t.Errorf("expected verification to fail with tampered sig")
		}
	})

	t.Run("expired timestamp fails", func(t *testing.T) {
		q := Sign(fileName, -1*time.Minute)
		values, _ := url.ParseQuery(q)
		exp := values.Get("exp")
		sig := values.Get("sig")

		if Verify(fileName, exp, sig) {
			t.Errorf("expected verification to fail for expired timestamp")
		}
	})

	t.Run("invalid or empty params fail", func(t *testing.T) {
		if Verify("", "123456", "abcdef") {
			t.Errorf("expected empty filename to fail")
		}
		if Verify(fileName, "", "abcdef") {
			t.Errorf("expected empty exp to fail")
		}
		if Verify(fileName, "123456", "") {
			t.Errorf("expected empty sig to fail")
		}
		if Verify(fileName, "not-a-number", "abcdef") {
			t.Errorf("expected invalid exp to fail")
		}
		if Verify(fileName, "9999999999", "not-hex") {
			t.Errorf("expected non-hex sig to fail")
		}
	})
}

// A link stays the same within one TTL window, so a re-read list (live updates) doesn't make the
// phone or the browser download the photo again; it is still valid for at least the TTL.
func TestSignStableWithinWindow(t *testing.T) {
	Configure("stable-window-secret", time.Hour)
	defer func() { now = time.Now }()
	base := time.Date(2026, 11, 21, 10, 5, 0, 0, time.UTC)
	at := func(d time.Duration) string {
		now = func() time.Time { return base.Add(d) }
		return Sign("p.jpg", 0)
	}

	first := at(0)
	if again := at(30 * time.Minute); again != first {
		t.Errorf("link changed within the window:\n%s\n%s", first, again)
	}
	if next := at(time.Hour); next == first {
		t.Error("link should change in the next window")
	}

	for _, d := range []time.Duration{0, 30 * time.Minute, 54*time.Minute + 59*time.Second} {
		q, _ := url.ParseQuery(at(d))
		exp, _ := strconv.ParseInt(q.Get("exp"), 10, 64)
		left := time.Unix(exp, 0).Sub(base.Add(d))
		if left < time.Hour || left > 2*time.Hour {
			t.Errorf("at +%v the link lives %v, want between 1 h and 2 h", d, left)
		}
		if !Verify("p.jpg", q.Get("exp"), q.Get("sig")) {
			t.Errorf("at +%v the link doesn't verify", d)
		}
	}
}
