package materials

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pc1605/rps/apps/backend/internal/audit"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

var (
	typeCodeRe = regexp.MustCompile(`^[A-Z0-9][A-Z0-9-]{0,31}$`)
	units      = map[string]bool{"m": true, "sqm": true, "pcs": true, "spool": true, "kg": true}
)

func invalid(format string, a ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalid, fmt.Sprintf(format, a...))
}

func (s *Service) withTx(ctx context.Context, fn func(pgx.Tx) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func writeAudit(ctx context.Context, tx pgx.Tx, a Actor, entity, id string, action audit.Action, before, after any) error {
	return audit.Write(ctx, tx, audit.Entry{
		ActorID: a.UserID.String(), ActorRole: a.Role, EntityType: entity, EntityID: id,
		Action: action, Before: before, After: after, IP: a.IP,
	})
}

// ───────────────────────── types ─────────────────────────

const typeSelect = `
	SELECT t.id, t.code, t.name, t.unit::text, t.has_variants, (t.min_level * 1000)::bigint, t.sort, t.is_active,
	       COALESCE((SELECT (SUM(l.qty_remaining) * 1000)::bigint FROM material_lots l
	                 WHERE l.material_type_id = t.id AND l.is_active), 0),
	       (SELECT COUNT(*) FROM material_lots l WHERE l.material_type_id = t.id AND l.is_active),
	       t.created_at
	FROM material_types t`

func scanType(row pgx.Row) (*MaterialType, error) {
	var t MaterialType
	if err := row.Scan(&t.ID, &t.Code, &t.Name, &t.Unit, &t.HasVariants, &t.MinLevel, &t.Sort, &t.IsActive,
		&t.StockRemaining, &t.ActiveLots, &t.CreatedAt); err != nil {
		return nil, err
	}
	t.IsLow = t.IsActive && t.MinLevel != nil && t.StockRemaining < *t.MinLevel
	return &t, nil
}

func (s *Service) ListTypes(ctx context.Context) ([]MaterialType, error) {
	rows, err := s.pool.Query(ctx, typeSelect+` ORDER BY t.sort, t.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MaterialType{}
	for rows.Next() {
		t, err := scanType(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, rows.Err()
}

func (s *Service) getType(ctx context.Context, q Querier, id int) (*MaterialType, error) {
	t, err := scanType(q.QueryRow(ctx, typeSelect+` WHERE t.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("%w: material type %d", ErrNotFound, id)
	}
	return t, err
}

func normType(in *TypeInput) error {
	if in.Code != nil {
		c := strings.ToUpper(strings.TrimSpace(*in.Code))
		if !typeCodeRe.MatchString(c) {
			return invalid("code must be 1–32 of A–Z, 0–9, '-'")
		}
		in.Code = &c
	}
	if in.Name != nil {
		n := strings.TrimSpace(*in.Name)
		if n == "" {
			return invalid("name is required")
		}
		in.Name = &n
	}
	if in.Unit != nil && !units[*in.Unit] {
		return invalid("unit must be one of m, sqm, pcs, spool, kg")
	}
	if in.MinLevel.Value != nil && *in.MinLevel.Value < 0 {
		return invalid("min_level must be ≥ 0")
	}
	return nil
}

func (s *Service) CreateType(ctx context.Context, in TypeInput, a Actor) (*MaterialType, error) {
	if in.Code == nil || in.Name == nil || in.Unit == nil {
		return nil, invalid("code, name and unit are required")
	}
	if err := normType(&in); err != nil {
		return nil, err
	}
	hasVariants, sort, active := false, 0, true
	if in.HasVariants != nil {
		hasVariants = *in.HasVariants
	}
	if in.Sort != nil {
		sort = *in.Sort
	}
	if in.IsActive != nil {
		active = *in.IsActive
	}
	var out *MaterialType
	err := s.withTx(ctx, func(tx pgx.Tx) error {
		var id int
		if err := tx.QueryRow(ctx, `
			INSERT INTO material_types (code, name, unit, has_variants, min_level, sort, is_active)
			VALUES ($1, $2, $3::material_unit, $4, $5::bigint::numeric / 1000, $6, $7) RETURNING id`,
			*in.Code, *in.Name, *in.Unit, hasVariants, milliArg(in.MinLevel.Value), sort, active).Scan(&id); err != nil {
			if isUnique(err) {
				return fmt.Errorf("%w: material type code %q", ErrDuplicate, *in.Code)
			}
			return err
		}
		t, err := s.getType(ctx, tx, id)
		if err != nil {
			return err
		}
		out = t
		return writeAudit(ctx, tx, a, "material_type", fmt.Sprint(id), audit.ActionCreate, nil, t)
	})
	return out, err
}

func (s *Service) UpdateType(ctx context.Context, id int, in TypeInput, a Actor) (*MaterialType, error) {
	if err := normType(&in); err != nil {
		return nil, err
	}
	var out *MaterialType
	err := s.withTx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT 1 FROM material_types WHERE id = $1 FOR UPDATE`, id); err != nil {
			return err
		}
		before, err := s.getType(ctx, tx, id)
		if err != nil {
			return err
		}
		if in.Unit != nil && *in.Unit != before.Unit {
			var moved bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM material_movements WHERE material_type_id = $1)`, id).Scan(&moved); err != nil {
				return err
			}
			if moved {
				return ErrUnitLocked
			}
		}
		if in.HasVariants != nil && !*in.HasVariants && before.HasVariants {
			var active, used bool
			if err := tx.QueryRow(ctx, `
				SELECT EXISTS(SELECT 1 FROM material_variants WHERE material_type_id = $1 AND is_active),
				       EXISTS(SELECT 1 FROM material_lots WHERE material_type_id = $1 AND variant_id IS NOT NULL)
				    OR EXISTS(SELECT 1 FROM recipe_lines WHERE material_type_id = $1 AND variant_id IS NOT NULL)
				    OR EXISTS(SELECT 1 FROM car_material_overrides WHERE material_type_id = $1 AND variant_id IS NOT NULL)`,
				id).Scan(&active, &used); err != nil {
				return err
			}
			if active {
				return ErrHasActiveVariants
			}
			if used {
				return ErrVariantsInUse
			}
		}
		if _, err := tx.Exec(ctx, `
			UPDATE material_types SET
			  code = COALESCE($2, code), name = COALESCE($3, name), unit = COALESCE($4::material_unit, unit),
			  has_variants = COALESCE($5, has_variants),
			  min_level = CASE WHEN $6 THEN $7::bigint::numeric / 1000 ELSE min_level END,
			  sort = COALESCE($8, sort), is_active = COALESCE($9, is_active)
			WHERE id = $1`,
			id, in.Code, in.Name, in.Unit, in.HasVariants, in.MinLevel.Set, milliArg(in.MinLevel.Value),
			in.Sort, in.IsActive); err != nil {
			if isUnique(err) {
				return fmt.Errorf("%w: material type code %q", ErrDuplicate, *in.Code)
			}
			return err
		}
		after, err := s.getType(ctx, tx, id)
		if err != nil {
			return err
		}
		out = after
		return writeAudit(ctx, tx, a, "material_type", fmt.Sprint(id), audit.ActionUpdate, before, after)
	})
	return out, err
}

// ───────────────────────── variants ─────────────────────────

const variantSelect = `SELECT id, material_type_id, name, specs, is_active, created_at FROM material_variants`

func scanVariant(row pgx.Row) (*Variant, error) {
	var v Variant
	var specs []byte
	if err := row.Scan(&v.ID, &v.MaterialTypeID, &v.Name, &specs, &v.IsActive, &v.CreatedAt); err != nil {
		return nil, err
	}
	v.Specs = specs
	return &v, nil
}

func (s *Service) ListVariants(ctx context.Context, typeID int) ([]Variant, error) {
	if _, err := s.getType(ctx, s.pool, typeID); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, variantSelect+` WHERE material_type_id = $1 ORDER BY is_active DESC, name`, typeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Variant{}
	for rows.Next() {
		v, err := scanVariant(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *v)
	}
	return out, rows.Err()
}

func normVariant(in *VariantInput) error {
	if in.Name != nil {
		n := strings.TrimSpace(*in.Name)
		if n == "" {
			return invalid("name is required")
		}
		in.Name = &n
	}
	if in.Specs != nil {
		var obj map[string]any
		if err := json.Unmarshal(*in.Specs, &obj); err != nil || obj == nil {
			return invalid(`specs must be a JSON object, e.g. {"width_in": 60}`)
		}
	}
	return nil
}

func (s *Service) CreateVariant(ctx context.Context, typeID int, in VariantInput, a Actor) (*Variant, error) {
	if in.Name == nil {
		return nil, invalid("name is required")
	}
	if err := normVariant(&in); err != nil {
		return nil, err
	}
	specs := json.RawMessage(`{}`)
	if in.Specs != nil {
		specs = *in.Specs
	}
	active := true
	if in.IsActive != nil {
		active = *in.IsActive
	}
	var out *Variant
	err := s.withTx(ctx, func(tx pgx.Tx) error {
		t, err := s.getType(ctx, tx, typeID)
		if err != nil {
			return err
		}
		if !t.HasVariants {
			return invalid("type %s has no variants — set has_variants first", t.Code)
		}
		v, err := scanVariant(tx.QueryRow(ctx, `
			INSERT INTO material_variants (material_type_id, name, specs, is_active) VALUES ($1, $2, $3, $4)
			RETURNING id, material_type_id, name, specs, is_active, created_at`, typeID, *in.Name, []byte(specs), active))
		if err != nil {
			if isUnique(err) {
				return fmt.Errorf("%w: variant %q on %s", ErrDuplicate, *in.Name, t.Code)
			}
			return err
		}
		out = v
		return writeAudit(ctx, tx, a, "material_variant", fmt.Sprint(v.ID), audit.ActionCreate, nil, v)
	})
	return out, err
}

func (s *Service) UpdateVariant(ctx context.Context, id int, in VariantInput, a Actor) (*Variant, error) {
	if err := normVariant(&in); err != nil {
		return nil, err
	}
	var specs []byte
	if in.Specs != nil {
		specs = *in.Specs
	}
	var out *Variant
	err := s.withTx(ctx, func(tx pgx.Tx) error {
		before, err := scanVariant(tx.QueryRow(ctx, variantSelect+` WHERE id = $1 FOR UPDATE`, id))
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: variant %d", ErrNotFound, id)
		}
		if err != nil {
			return err
		}
		after, err := scanVariant(tx.QueryRow(ctx, `
			UPDATE material_variants SET name = COALESCE($2, name), specs = COALESCE($3::jsonb, specs),
			  is_active = COALESCE($4, is_active)
			WHERE id = $1 RETURNING id, material_type_id, name, specs, is_active, created_at`,
			id, in.Name, specs, in.IsActive))
		if err != nil {
			if isUnique(err) {
				return fmt.Errorf("%w: variant name %q", ErrDuplicate, *in.Name)
			}
			return err
		}
		out = after
		return writeAudit(ctx, tx, a, "material_variant", fmt.Sprint(id), audit.ActionUpdate, before, after)
	})
	return out, err
}

// ───────────────────────── lots ─────────────────────────

const lotSelect = `
	SELECT l.id, l.lot_code, l.material_type_id, t.code, t.name, t.unit::text, l.variant_id, v.name, l.color,
	       (l.qty_received * 1000)::bigint, (l.qty_remaining * 1000)::bigint, (l.unit_cost * 1000)::bigint,
	       l.supplier, l.note, l.is_active, l.received_at, l.created_at,
	       (SELECT MAX(m.created_at) FROM material_movements m WHERE m.lot_id = l.id)
	FROM material_lots l
	JOIN material_types t ON t.id = l.material_type_id
	LEFT JOIN material_variants v ON v.id = l.variant_id`

func scanLot(row pgx.Row) (*Lot, error) {
	var l Lot
	if err := row.Scan(&l.ID, &l.LotCode, &l.MaterialTypeID, &l.TypeCode, &l.TypeName, &l.Unit, &l.VariantID,
		&l.VariantName, &l.Color, &l.QtyReceived, &l.QtyRemaining, &l.UnitCost, &l.Supplier, &l.Note,
		&l.IsActive, &l.ReceivedAt, &l.CreatedAt, &l.LastMovementAt); err != nil {
		return nil, err
	}
	return &l, nil
}

func (s *Service) getLot(ctx context.Context, q Querier, id uuid.UUID) (*Lot, error) {
	l, err := scanLot(q.QueryRow(ctx, lotSelect+` WHERE l.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("%w: lot %s", ErrNotFound, id)
	}
	return l, err
}

// ListLots: typeID filters by type; active filters is_active; low = only lots of types below min_level.
func (s *Service) ListLots(ctx context.Context, typeID *int, active *bool, low bool) ([]Lot, error) {
	rows, err := s.pool.Query(ctx, lotSelect+`
		WHERE ($1::int IS NULL OR l.material_type_id = $1)
		  AND ($2::bool IS NULL OR l.is_active = $2)
		  AND (NOT $3 OR (t.min_level IS NOT NULL AND
		       COALESCE((SELECT SUM(x.qty_remaining) FROM material_lots x
		                 WHERE x.material_type_id = t.id AND x.is_active), 0) < t.min_level))
		ORDER BY l.is_active DESC, l.received_at DESC, l.lot_code`, typeID, active, low)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Lot{}
	for rows.Next() {
		l, err := scanLot(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *l)
	}
	return out, rows.Err()
}

// checkVariant validates (type, variant) for a lot: variant must belong to the type, be active when
// newly assigned, and is required iff the type has variants (when required=true).
func checkVariant(ctx context.Context, q Querier, t *MaterialType, variantID *int, required bool) error {
	if !t.HasVariants {
		if variantID != nil {
			return invalid("type %s has no variants — variant_id must be empty", t.Code)
		}
		return nil
	}
	if variantID == nil {
		if required {
			return invalid("variant_id is required for %s", t.Code)
		}
		return nil
	}
	var ok bool
	if err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM material_variants WHERE id = $1 AND material_type_id = $2 AND is_active)`,
		*variantID, t.ID).Scan(&ok); err != nil {
		return err
	}
	if !ok {
		return invalid("variant %d is not an active variant of %s", *variantID, t.Code)
	}
	return nil
}

func (s *Service) Receive(ctx context.Context, in ReceiveInput, a Actor) (*Lot, error) {
	in.LotCode = strings.TrimSpace(in.LotCode)
	in.Color = strings.TrimSpace(in.Color)
	switch {
	case in.MaterialTypeID == 0:
		return nil, invalid("material_type_id is required")
	case in.LotCode == "":
		return nil, invalid("lot_code is required")
	case in.Color == "":
		return nil, invalid("color is required")
	case in.Qty <= 0:
		return nil, invalid("qty must be > 0")
	case in.UnitCost != nil && (*in.UnitCost < 0 || *in.UnitCost%10 != 0):
		return nil, invalid("unit_cost must be ≥ 0 with at most 2 decimals")
	}
	var out *Lot
	err := s.withTx(ctx, func(tx pgx.Tx) error {
		t, err := s.getType(ctx, tx, in.MaterialTypeID)
		if err != nil {
			return err
		}
		if !t.IsActive {
			return invalid("material type %s is inactive", t.Code)
		}
		if err := checkVariant(ctx, tx, t, in.VariantID, true); err != nil {
			return err
		}
		var id uuid.UUID
		// qty_remaining starts at 0; the receive movement brings it to qty.
		if err := tx.QueryRow(ctx, `
			INSERT INTO material_lots (lot_code, color, qty_received, qty_remaining, material_type_id, variant_id,
			                           unit_cost, supplier, note)
			VALUES ($1, $2, $3::bigint::numeric / 1000, 0, $4, $5, $6::bigint::numeric / 1000, NULLIF($7, ''), NULLIF($8, ''))
			RETURNING id`,
			in.LotCode, in.Color, int64(in.Qty), t.ID, in.VariantID, milliArg(in.UnitCost),
			strOr(in.Supplier), strOr(in.Note)).Scan(&id); err != nil {
			if isUnique(err) {
				return fmt.Errorf("%w: lot code %q", ErrDuplicate, in.LotCode)
			}
			return err
		}
		if _, err := InsertMovement(ctx, tx, MovementInput{LotID: &id, TypeID: t.ID, VariantID: in.VariantID,
			Kind: "receive", Qty: in.Qty, ActorUserID: &a.UserID, Reason: "received"}); err != nil {
			return err
		}
		l, err := s.getLot(ctx, tx, id)
		if err != nil {
			return err
		}
		out = l
		return writeAudit(ctx, tx, a, "material_lot", id.String(), audit.ActionCreate, nil, l)
	})
	return out, err
}

// lockLot locks the lot row and returns it.
func (s *Service) lockLot(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*Lot, error) {
	if _, err := tx.Exec(ctx, `SELECT 1 FROM material_lots WHERE id = $1 FOR UPDATE`, id); err != nil {
		return nil, err
	}
	return s.getLot(ctx, tx, id)
}

// lotMovement applies one admin movement (adjust / waste / return) to a lot.
func (s *Service) lotMovement(ctx context.Context, id uuid.UUID, kind string, delta func(*Lot) (Milli, error), reason string, a Actor) (*Lot, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, invalid("reason is required")
	}
	var out *Lot
	err := s.withTx(ctx, func(tx pgx.Tx) error {
		before, err := s.lockLot(ctx, tx, id)
		if err != nil {
			return err
		}
		d, err := delta(before)
		if err != nil {
			return err
		}
		mid, err := InsertMovement(ctx, tx, MovementInput{LotID: &id, TypeID: before.MaterialTypeID,
			VariantID: before.VariantID, Kind: kind, Qty: d, ActorUserID: &a.UserID, Reason: reason})
		if err != nil {
			return err
		}
		after, err := s.getLot(ctx, tx, id)
		if err != nil {
			return err
		}
		out = after
		return writeAudit(ctx, tx, a, "material_lot", id.String(), audit.ActionTransition,
			map[string]any{"qty_remaining": before.QtyRemaining},
			map[string]any{"qty_remaining": after.QtyRemaining, "event": kind, "qty": d, "movement_id": mid, "reason": reason})
	})
	return out, err
}

func (s *Service) Adjust(ctx context.Context, id uuid.UUID, in AdjustInput, a Actor) (*Lot, error) {
	if in.NewRemaining == nil || *in.NewRemaining < 0 {
		return nil, invalid("new_remaining (≥ 0) is required")
	}
	return s.lotMovement(ctx, id, "adjust", func(l *Lot) (Milli, error) {
		d := *in.NewRemaining - l.QtyRemaining
		if d == 0 {
			return 0, invalid("new_remaining equals the current remaining (%s) — nothing to adjust", l.QtyRemaining)
		}
		return d, nil
	}, in.Reason, a)
}

func (s *Service) Waste(ctx context.Context, id uuid.UUID, in QtyReasonInput, a Actor) (*Lot, error) {
	if in.Qty <= 0 {
		return nil, invalid("qty must be > 0")
	}
	return s.lotMovement(ctx, id, "waste", func(l *Lot) (Milli, error) {
		if in.Qty > l.QtyRemaining {
			return 0, invalid("waste %s exceeds remaining %s %s", in.Qty, l.QtyRemaining, l.Unit)
		}
		return -in.Qty, nil
	}, in.Reason, a)
}

func (s *Service) Return(ctx context.Context, id uuid.UUID, in QtyReasonInput, a Actor) (*Lot, error) {
	if in.Qty <= 0 {
		return nil, invalid("qty must be > 0")
	}
	return s.lotMovement(ctx, id, "return", func(*Lot) (Milli, error) {
		if in.Qty > MaxMilli {
			return 0, invalid("qty too large")
		}
		return in.Qty, nil
	}, in.Reason, a)
}

// PatchLot edits descriptive fields; re-classifying type/variant is allowed only before any
// consumption/waste/return and moves the lot's opening movements along in the same tx.
func (s *Service) PatchLot(ctx context.Context, id uuid.UUID, in LotPatch, a Actor) (*Lot, error) {
	if in.Color != nil {
		c := strings.TrimSpace(*in.Color)
		if c == "" {
			return nil, invalid("color can't be empty")
		}
		in.Color = &c
	}
	if in.UnitCost.Value != nil && (*in.UnitCost.Value < 0 || *in.UnitCost.Value%10 != 0) {
		return nil, invalid("unit_cost must be ≥ 0 with at most 2 decimals")
	}
	var out *Lot
	err := s.withTx(ctx, func(tx pgx.Tx) error {
		before, err := s.lockLot(ctx, tx, id)
		if err != nil {
			return err
		}
		newType, newVariant := before.MaterialTypeID, before.VariantID
		if in.MaterialTypeID != nil {
			newType = *in.MaterialTypeID
			if newType != before.MaterialTypeID && !in.VariantID.Set {
				newVariant = nil // a variant never carries over to another type
			}
		}
		if in.VariantID.Set {
			newVariant = in.VariantID.Value
		}
		reclassify := newType != before.MaterialTypeID || !sameInt(newVariant, before.VariantID)
		if reclassify {
			var consumed bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM material_movements
				WHERE lot_id = $1 AND kind IN ('consume', 'waste', 'return'))`, id).Scan(&consumed); err != nil {
				return err
			}
			if consumed {
				return ErrLotHasConsumption
			}
			t, err := s.getType(ctx, tx, newType)
			if err != nil {
				return err
			}
			if err := checkVariant(ctx, tx, t, newVariant, false); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, `UPDATE material_movements SET material_type_id = $2, variant_id = $3 WHERE lot_id = $1`,
				id, newType, newVariant); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(ctx, `
			UPDATE material_lots SET
			  is_active = COALESCE($2, is_active), color = COALESCE($3, color),
			  supplier  = CASE WHEN $4 THEN NULLIF($5, '') ELSE supplier END,
			  note      = CASE WHEN $6 THEN NULLIF($7, '') ELSE note END,
			  unit_cost = CASE WHEN $8 THEN $9::bigint::numeric / 1000 ELSE unit_cost END,
			  material_type_id = $10, variant_id = $11
			WHERE id = $1`,
			id, in.IsActive, in.Color, in.Supplier.Set, strOr(in.Supplier.Value), in.Note.Set, strOr(in.Note.Value),
			in.UnitCost.Set, milliArg(in.UnitCost.Value), newType, newVariant); err != nil {
			return err
		}
		after, err := s.getLot(ctx, tx, id)
		if err != nil {
			return err
		}
		out = after
		return writeAudit(ctx, tx, a, "material_lot", id.String(), audit.ActionUpdate, before, after)
	})
	return out, err
}

// ───────────────────────── movements ─────────────────────────

const movementSelect = `
	SELECT m.id, m.created_at, m.kind::text, (m.qty * 1000)::bigint, m.reason, m.lot_id, l.lot_code, l.color,
	       m.material_type_id, t.code, t.name, t.unit::text, m.variant_id, v.name, m.batch_id, b.batch_code,
	       m.phase_log_id, m.actor_user_id, u.name, m.actor_worker_id, w.name
	FROM material_movements m
	JOIN material_types t ON t.id = m.material_type_id
	LEFT JOIN material_lots l ON l.id = m.lot_id
	LEFT JOIN material_variants v ON v.id = m.variant_id
	LEFT JOIN batches b ON b.id = m.batch_id
	LEFT JOIN users u ON u.id = m.actor_user_id
	LEFT JOIN workers w ON w.id = m.actor_worker_id`

func scanMovement(row pgx.Row) (*Movement, error) {
	var m Movement
	if err := row.Scan(&m.ID, &m.CreatedAt, &m.Kind, &m.Qty, &m.Reason, &m.LotID, &m.LotCode, &m.Color,
		&m.MaterialTypeID, &m.TypeCode, &m.TypeName, &m.Unit, &m.VariantID, &m.VariantName, &m.BatchID,
		&m.BatchCode, &m.PhaseLogID, &m.ActorUserID, &m.ActorUserName, &m.ActorWorkerID, &m.ActorWorkerName); err != nil {
		return nil, err
	}
	return &m, nil
}

func encodeCursor(at time.Time, id uuid.UUID) string {
	return base64.RawURLEncoding.EncodeToString([]byte(at.UTC().Format(time.RFC3339Nano) + "|" + id.String()))
}

func decodeCursor(c string) (time.Time, uuid.UUID, error) {
	b, err := base64.RawURLEncoding.DecodeString(c)
	if err != nil {
		return time.Time{}, uuid.Nil, invalid("bad cursor")
	}
	ts, ids, ok := strings.Cut(string(b), "|")
	at, err1 := time.Parse(time.RFC3339Nano, ts)
	id, err2 := uuid.Parse(ids)
	if !ok || err1 != nil || err2 != nil {
		return time.Time{}, uuid.Nil, invalid("bad cursor")
	}
	return at, id, nil
}

// ListMovements returns the ledger newest first with keyset pagination.
func (s *Service) ListMovements(ctx context.Context, f MovementFilter) (*MovementPage, error) {
	if f.Limit <= 0 {
		f.Limit = 50
	}
	if f.Limit > 200 {
		f.Limit = 200
	}
	var cAt *time.Time
	var cID *uuid.UUID
	if f.Cursor != "" {
		at, id, err := decodeCursor(f.Cursor)
		if err != nil {
			return nil, err
		}
		cAt, cID = &at, &id
	}
	rows, err := s.pool.Query(ctx, movementSelect+`
		WHERE ($1::uuid IS NULL OR m.lot_id = $1)
		  AND ($2::int IS NULL OR m.material_type_id = $2)
		  AND ($3::uuid IS NULL OR m.batch_id = $3)
		  AND ($4::timestamptz IS NULL OR m.created_at >= $4)
		  AND ($5::timestamptz IS NULL OR m.created_at < $5)
		  AND ($6::timestamptz IS NULL OR (m.created_at, m.id) < ($6, $7::uuid))
		ORDER BY m.created_at DESC, m.id DESC
		LIMIT $8`, f.LotID, f.TypeID, f.BatchID, f.From, f.To, cAt, cID, f.Limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	page := &MovementPage{Items: []Movement{}}
	for rows.Next() {
		m, err := scanMovement(rows)
		if err != nil {
			return nil, err
		}
		page.Items = append(page.Items, *m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(page.Items) > f.Limit {
		page.Items = page.Items[:f.Limit]
		last := page.Items[len(page.Items)-1]
		c := encodeCursor(last.CreatedAt, last.ID)
		page.NextCursor = &c
	}
	return page, nil
}

// ───────────────────────── helpers ─────────────────────────

func milliArg(m *Milli) *int64 {
	if m == nil {
		return nil
	}
	v := int64(*m)
	return &v
}

func strOr(s *string) string {
	if s == nil {
		return ""
	}
	return strings.TrimSpace(*s)
}

func sameInt(a, b *int) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && *a == *b)
}
