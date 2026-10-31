package batch

import (
	"context"
	"fmt"
	"strings"
)

// Global search (U2): batches, mats, cars (incl. exact barcode), workers, lots.

type SearchHit struct {
	Kind  string `json:"kind"`  // batch | unit | car | worker | lot
	ID    string `json:"id"`    // batch/worker/lot uuid, car id, unit code
	Label string `json:"label"` // code or name
	Sub   string `json:"sub"`   // context line
}

type SearchResult struct {
	Q     string      `json:"q"`
	Exact *SearchHit  `json:"exact,omitempty"` // a full code / barcode match → open it directly
	Hits  []SearchHit `json:"hits"`
}

const searchPerKind = 5

// Search matches q (≥ 2 chars) case-insensitively. Exact batch code, unit code, barcode or lot
// code wins as `exact` (scanner input).
func (s *Service) Search(ctx context.Context, q string) (*SearchResult, error) {
	q = strings.TrimSpace(q)
	out := &SearchResult{Q: q, Hits: []SearchHit{}}
	if len([]rune(q)) < 2 {
		return out, nil
	}
	like := "%" + likeEscape(q) + "%"
	prefix := likeEscape(q) + "%"
	queries := []struct {
		kind, sql string
		args      []any
	}{
		{"unit", `
			SELECT u.unit_code, u.unit_code, b.batch_code || ' · ' || cb.name || ' ' || cm.name, upper(u.unit_code) = upper($2)
			FROM batch_units u JOIN batches b ON b.id = u.batch_id
			JOIN car_models cm ON cm.id = b.car_model_id JOIN car_brands cb ON cb.id = cm.brand_id
			WHERE u.unit_code ILIKE $1 ORDER BY u.unit_code LIMIT $3`, []any{prefix, q, searchPerKind}},
		{"batch", `
			SELECT b.id::text, b.batch_code, cb.name || ' ' || cm.name || ' · ' || b.quantity || ' mats · ' || b.current_phase,
			       upper(b.batch_code) = upper($2)
			FROM batches b JOIN car_models cm ON cm.id = b.car_model_id JOIN car_brands cb ON cb.id = cm.brand_id
			WHERE b.batch_code ILIKE $1 ORDER BY b.created_at DESC LIMIT $3`, []any{like, q, searchPerKind}},
		{"car", `
			SELECT cm.id::text, cb.name || ' ' || cm.name,
			       cm.size_class::text || COALESCE(' · ' || pl.name, '') || COALESCE(' · ' || cm.barcode, ''), cm.barcode = $2
			FROM car_models cm JOIN car_brands cb ON cb.id = cm.brand_id LEFT JOIN product_lines pl ON pl.id = cm.product_line_id
			WHERE (cb.name || ' ' || cm.name) ILIKE $1 OR cm.barcode = $2
			ORDER BY (cm.barcode = $2) DESC, cm.is_active DESC, cb.name, cm.name LIMIT $3`, []any{like, q, searchPerKind}},
		{"worker", `
			SELECT w.id::text, w.name, w.station::text || CASE WHEN w.is_active THEN '' ELSE ' · inactive' END, false
			FROM workers w WHERE w.name ILIKE $1 ORDER BY w.is_active DESC, w.name LIMIT $2`, []any{like, searchPerKind}},
		{"lot", `
			SELECT l.id::text, l.lot_code, t.name || ' · ' || l.color, upper(l.lot_code) = upper($2)
			FROM material_lots l JOIN material_types t ON t.id = l.material_type_id
			WHERE l.lot_code ILIKE $1 ORDER BY l.is_active DESC, l.received_at DESC LIMIT $3`, []any{like, q, searchPerKind}},
	}
	for _, qq := range queries {
		rows, err := s.pool.Query(ctx, qq.sql, qq.args...)
		if err != nil {
			return nil, fmt.Errorf("search %s: %w", qq.kind, err)
		}
		for rows.Next() {
			h := SearchHit{Kind: qq.kind}
			var exact bool
			if err := rows.Scan(&h.ID, &h.Label, &h.Sub, &exact); err != nil {
				rows.Close()
				return nil, err
			}
			if exact && out.Exact == nil {
				e := h
				out.Exact = &e
			}
			out.Hits = append(out.Hits, h)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, err
		}
	}
	return out, nil
}
