package batch

import (
	"context"
	"errors"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// U2: list filters / sort / pagination and global search, checked against direct SQL on the
// seeded test DB (read-only).
func TestListPageAndSearch(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	s := NewService(pool, t.TempDir())
	count := func(where string) int {
		t.Helper()
		var n int
		if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM batches b JOIN car_models cm ON cm.id = b.car_model_id WHERE `+where).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}

	all, err := s.ListPage(ctx, ListFilter{Desc: true})
	if err != nil {
		t.Fatal(err)
	}
	if all.Total != count("true") || len(all.Items) != all.Total {
		t.Fatalf("unfiltered: total %d, items %d, sql %d", all.Total, len(all.Items), count("true"))
	}
	if all.Total < 4 {
		t.Skip("seed too small for paging checks")
	}

	// Pages are disjoint, in order, and add up to the full list.
	var paged []string
	for p := 1; ; p++ {
		pg, err := s.ListPage(ctx, ListFilter{Desc: true, Page: p, Limit: 3})
		if err != nil {
			t.Fatal(err)
		}
		if pg.Total != all.Total {
			t.Fatalf("page %d total %d != %d", p, pg.Total, all.Total)
		}
		for _, b := range pg.Items {
			paged = append(paged, b.ID.String())
		}
		if len(pg.Items) < 3 {
			break
		}
	}
	for i, b := range all.Items {
		if i >= len(paged) || paged[i] != b.ID.String() {
			t.Fatalf("paged order differs from full list at %d", i)
		}
	}

	// Views match their SQL definitions.
	for view, cond := range listViews {
		pg, err := s.ListPage(ctx, ListFilter{View: view})
		if err != nil {
			t.Fatal(err)
		}
		if want := count(cond); pg.Total != want {
			t.Errorf("view %s: total %d, sql %d", view, pg.Total, want)
		}
	}

	// Sorts are monotonic.
	byCode, _ := s.ListPage(ctx, ListFilter{Sort: "code"})
	if !sort.SliceIsSorted(byCode.Items, func(i, j int) bool { return byCode.Items[i].BatchCode < byCode.Items[j].BatchCode }) {
		t.Error("sort=code asc not ordered")
	}
	byQty, _ := s.ListPage(ctx, ListFilter{Sort: "quantity", Desc: true})
	for i := 1; i < len(byQty.Items); i++ {
		if byQty.Items[i].Quantity > byQty.Items[i-1].Quantity {
			t.Fatal("sort=quantity desc not ordered")
		}
	}

	// q: batch code substring; exact barcode.
	first := all.Items[0]
	sub := first.BatchCode[len(first.BatchCode)-3:]
	pg, _ := s.ListPage(ctx, ListFilter{Q: sub})
	found := false
	for _, b := range pg.Items {
		found = found || b.ID == first.ID
	}
	if !found {
		t.Errorf("q=%q missed %s", sub, first.BatchCode)
	}
	if first.Barcode != nil {
		pg, _ = s.ListPage(ctx, ListFilter{Q: *first.Barcode})
		for _, b := range pg.Items {
			if b.CarModelID != first.CarModelID {
				t.Errorf("barcode q matched another car: %s", b.BatchCode)
			}
		}
	}
	if pg, _ = s.ListPage(ctx, ListFilter{Q: "%"}); pg.Total != 0 {
		t.Errorf("q=%% is a wildcard: %d hits", pg.Total)
	}

	// Toggles.
	yes, no := true, false
	rw, _ := s.ListPage(ctx, ListFilter{HasRework: &yes})
	for _, b := range rw.Items {
		if b.ReworkOpen == 0 {
			t.Errorf("has_rework=true returned %s with no open rework", b.BatchCode)
		}
	}
	norw, _ := s.ListPage(ctx, ListFilter{HasRework: &no})
	if rw.Total+norw.Total != all.Total {
		t.Errorf("has_rework split %d + %d != %d", rw.Total, norw.Total, all.Total)
	}
	short, _ := s.ListPage(ctx, ListFilter{Short: &yes})
	if want := count(`b.status = 'awaiting_assignment' AND b.cut_qty < b.quantity`); short.Total != want {
		t.Errorf("short: %d, sql %d", short.Total, want)
	}
	future := time.Now().AddDate(1, 0, 0)
	if pg, _ = s.ListPage(ctx, ListFilter{From: &future}); pg.Total != 0 {
		t.Errorf("from=future: %d", pg.Total)
	}
	line := 0
	if err := pool.QueryRow(ctx, `SELECT product_line_id FROM car_models WHERE id = $1`, first.CarModelID).Scan(&line); err == nil {
		pg, _ = s.ListPage(ctx, ListFilter{ProductLineID: &line})
		if want := count("cm.product_line_id = " + strconv.Itoa(line)); pg.Total != want {
			t.Errorf("product_line: %d, sql %d", pg.Total, want)
		}
	}

	if _, err := s.ListPage(ctx, ListFilter{View: "nope"}); !errors.Is(err, ErrInvalidInput) {
		t.Errorf("bad view: %v", err)
	}
	if _, err := s.ListPage(ctx, ListFilter{Sort: "b.id; DROP TABLE"}); !errors.Is(err, ErrInvalidInput) {
		t.Errorf("bad sort: %v", err)
	}

	// Search.
	d, err := s.Get(ctx, first.ID)
	if err != nil || len(d.Units) == 0 {
		t.Fatalf("get: %v", err)
	}
	unit := d.Units[0].UnitCode
	for q, kind := range map[string]string{unit: "unit", strings.ToLower(unit): "unit", first.BatchCode: "batch"} {
		r, err := s.Search(ctx, q)
		if err != nil {
			t.Fatal(err)
		}
		if r.Exact == nil || r.Exact.Kind != kind {
			t.Errorf("search %q: exact = %+v, want %s", q, r.Exact, kind)
		}
	}
	if first.Barcode != nil {
		r, _ := s.Search(ctx, *first.Barcode)
		if r.Exact == nil || r.Exact.Kind != "car" || r.Exact.ID != strconv.Itoa(first.CarModelID) {
			t.Errorf("search barcode: exact = %+v", r.Exact)
		}
	}
	if r, _ := s.Search(ctx, "B"); len(r.Hits) != 0 {
		t.Errorf("1-char search returned %d hits", len(r.Hits))
	}
	if r, _ := s.Search(ctx, "%_"); len(r.Hits) != 0 {
		t.Errorf("wildcard search returned %d hits", len(r.Hits))
	}

	// Stats.working agrees with open logs.
	st, err := s.GetStats(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var open int
	if err := pool.QueryRow(ctx, `SELECT COUNT(DISTINCT b.current_phase) FROM phase_logs pl JOIN batches b ON b.id = pl.batch_id
		AND pl.phase = b.current_phase WHERE pl.completed_at IS NULL`).Scan(&open); err != nil {
		t.Fatal(err)
	}
	if len(st.Working) != open {
		t.Errorf("stats.working phases %d, sql %d (%v)", len(st.Working), open, st.Working)
	}
}
