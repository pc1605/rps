package materials

import (
	"fmt"
	"strings"
)

// Milli is a material quantity (or money) in thousandths of its unit — exact for numeric(12,3).
// Quantities never pass through float64: SQL reads `(x * 1000)::bigint` and writes
// `$n::bigint::numeric / 1000`; JSON numbers are parsed digit by digit.
type Milli int64

// MaxMilli is the largest numeric(12,3) value: 999,999,999.999.
const MaxMilli Milli = 999_999_999_999

// String renders 12.500 → "12.5", 3.000 → "3", -0.050 → "-0.05".
func (m Milli) String() string {
	sign := ""
	v := int64(m)
	if v < 0 {
		sign, v = "-", -v
	}
	s := fmt.Sprintf("%d.%03d", v/1000, v%1000)
	s = strings.TrimRight(strings.TrimRight(s, "0"), ".")
	return sign + s
}

// MarshalJSON writes a JSON number with up to 3 decimals.
func (m Milli) MarshalJSON() ([]byte, error) { return []byte(m.String()), nil }

// UnmarshalJSON accepts a plain JSON number with at most 3 decimals (no exponent).
func (m *Milli) UnmarshalJSON(b []byte) error {
	v, err := ParseMilli(string(b))
	if err != nil {
		return err
	}
	*m = v
	return nil
}

// ParseMilli parses "12", "12.5", "-0.125". Rejects >3 decimals, exponents and out-of-range values.
func ParseMilli(s string) (Milli, error) {
	s = strings.TrimSpace(s)
	neg := strings.HasPrefix(s, "-")
	if neg {
		s = s[1:]
	}
	intPart, frac, hasDot := strings.Cut(s, ".")
	if intPart == "" || (hasDot && frac == "") || !digits(intPart) || !digits(frac) {
		return 0, fmt.Errorf("not a plain decimal number: %q", s)
	}
	if len(frac) > 3 {
		return 0, fmt.Errorf("at most 3 decimals allowed: %q", s)
	}
	intPart = strings.TrimLeft(intPart, "0")
	if len(intPart) > 9 {
		return 0, fmt.Errorf("number too large: %q", s)
	}
	var v int64
	for _, c := range intPart + (frac + "000")[:3] {
		v = v*10 + int64(c-'0')
	}
	if neg {
		v = -v
	}
	return Milli(v), nil
}

func digits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}
