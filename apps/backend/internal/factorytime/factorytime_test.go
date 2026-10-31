package factorytime

import (
	"testing"
	"time"
)

func TestParseDayIsFactoryMidnight(t *testing.T) {
	if err := Configure("Asia/Kolkata"); err != nil {
		t.Fatal(err)
	}
	d, err := ParseDay("2026-10-31")
	if err != nil {
		t.Fatal(err)
	}
	// IST midnight = 18:30 UTC the previous day.
	want := time.Date(2026, 10, 30, 18, 30, 0, 0, time.UTC)
	if !d.Equal(want) {
		t.Fatalf("ParseDay = %s, want %s", d.UTC(), want)
	}
}

func TestStartOfDayEarlyMorningIST(t *testing.T) {
	if err := Configure("Asia/Kolkata"); err != nil {
		t.Fatal(err)
	}
	// 03:00 IST on 31 Oct is still 30 Oct in UTC; the factory day is 31 Oct.
	at := time.Date(2026, 10, 30, 21, 30, 0, 0, time.UTC)
	got := StartOfDay(at)
	if got.Format("2006-01-02") != "2026-10-31" || got.Hour() != 0 {
		t.Fatalf("StartOfDay = %s, want 2026-10-31 00:00 IST", got)
	}
}

func TestConfigureRejectsBadZone(t *testing.T) {
	if err := Configure("Not/AZone"); err == nil {
		t.Fatal("expected error for unknown zone")
	}
	if Name() != "Asia/Kolkata" {
		t.Fatalf("bad Configure must not change zone, got %s", Name())
	}
}
