// Package factorytime holds the factory's calendar timezone. Every "day"
// (report ranges, "today" counters) is a factory-local day, never UTC or the
// DB session's timezone.
package factorytime

import (
	"fmt"
	"sync"
	"time"
	_ "time/tzdata" // embed tz database so slim containers can load zones
)

// DefaultZone is used when FACTORY_TZ is unset.
const DefaultZone = "Asia/Kolkata"

var (
	mu   sync.RWMutex
	name = DefaultZone
	loc  = mustLoad(DefaultZone)
)

func mustLoad(n string) *time.Location {
	l, err := time.LoadLocation(n)
	if err != nil {
		panic(err)
	}
	return l
}

// Configure sets the factory timezone (IANA name, e.g. "Asia/Kolkata").
func Configure(zone string) error {
	if zone == "" {
		zone = DefaultZone
	}
	l, err := time.LoadLocation(zone)
	if err != nil {
		return fmt.Errorf("factory timezone %q: %w", zone, err)
	}
	mu.Lock()
	defer mu.Unlock()
	name, loc = zone, l
	return nil
}

// Name returns the IANA zone name (for SQL `AT TIME ZONE $n`).
func Name() string {
	mu.RLock()
	defer mu.RUnlock()
	return name
}

// Location returns the factory location.
func Location() *time.Location {
	mu.RLock()
	defer mu.RUnlock()
	return loc
}

// ParseDay parses YYYY-MM-DD as midnight factory time.
func ParseDay(s string) (time.Time, error) {
	return time.ParseInLocation("2006-01-02", s, Location())
}

// StartOfDay returns midnight factory time of the day containing t.
func StartOfDay(t time.Time) time.Time {
	t = t.In(Location())
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}
