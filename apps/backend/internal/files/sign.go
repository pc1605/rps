package files

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"sync"
	"time"
)

var (
	mu         sync.RWMutex
	secret     string
	defaultTTL = 60 * time.Minute
)

// Configure sets the signing secret and default TTL for file URLs.
func Configure(sec string, ttl time.Duration) {
	mu.Lock()
	defer mu.Unlock()
	secret = sec
	if ttl > 0 {
		defaultTTL = ttl
	}
}

// DefaultTTL returns the configured default TTL.
func DefaultTTL() time.Duration {
	mu.RLock()
	defer mu.RUnlock()
	return defaultTTL
}

// Sign generates a query string for the given file name and TTL in the format:
// exp=<unix>&sig=<hex HMAC-SHA256(secret, name + "|" + exp)>
func Sign(name string, ttl time.Duration) string {
	mu.RLock()
	sec := secret
	defTTL := defaultTTL
	mu.RUnlock()

	if ttl == 0 {
		ttl = defTTL
	}

	expStr := strconv.FormatInt(expiry(ttl), 10)

	mac := hmac.New(sha256.New, []byte(sec))
	mac.Write([]byte(name + "|" + expStr))
	sig := hex.EncodeToString(mac.Sum(nil))

	return fmt.Sprintf("exp=%s&sig=%s", expStr, sig)
}

// now is the clock; tests move it.
var now = time.Now

// expiry is now+ttl rounded up to a whole multiple of ttl. Every link made within one such window is
// the same, so phones and browsers keep the photo in their cache instead of downloading it again on
// every re-read of a list (live updates re-read often); a link is still valid for at least ttl
// (at most 2×ttl).
func expiry(ttl time.Duration) int64 {
	end := now().Add(ttl).Unix()
	step := int64(ttl / time.Second)
	if step <= 0 {
		return end
	}
	return (end/step + 1) * step
}

// Verify validates that the signature for the given file name and expiration timestamp
// matches the HMAC-SHA256 signature using constant-time comparison and that the expiration
// timestamp has not passed.
func Verify(name, exp, sig string) bool {
	if name == "" || exp == "" || sig == "" {
		return false
	}

	mu.RLock()
	sec := secret
	mu.RUnlock()

	if sec == "" {
		return false
	}

	expUnix, err := strconv.ParseInt(exp, 10, 64)
	if err != nil {
		return false
	}

	if now().Unix() > expUnix {
		return false
	}

	providedSig, err := hex.DecodeString(sig)
	if err != nil {
		return false
	}

	mac := hmac.New(sha256.New, []byte(sec))
	mac.Write([]byte(name + "|" + exp))
	expectedSig := mac.Sum(nil)

	return hmac.Equal(providedSig, expectedSig)
}
