package materials

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// JSON row shapes — mirrored in @rps/shared (domain.ts, "Materials (C1c)").

type MaterialType struct {
	ID             int       `json:"id"`
	Code           string    `json:"code"`
	Name           string    `json:"name"`
	Unit           string    `json:"unit"`
	HasVariants    bool      `json:"has_variants"`
	MinLevel       *Milli    `json:"min_level,omitempty"`
	Sort           int       `json:"sort"`
	IsActive       bool      `json:"is_active"`
	StockRemaining Milli     `json:"stock_remaining"` // SUM(active lots)
	ActiveLots     int       `json:"active_lots"`
	IsLow          bool      `json:"is_low"`
	CreatedAt      time.Time `json:"created_at"`
}

type Variant struct {
	ID             int             `json:"id"`
	MaterialTypeID int             `json:"material_type_id"`
	Name           string          `json:"name"`
	Specs          json.RawMessage `json:"specs"`
	IsActive       bool            `json:"is_active"`
	CreatedAt      time.Time       `json:"created_at"`
}

type Lot struct {
	ID             uuid.UUID  `json:"id"`
	LotCode        string     `json:"lot_code"`
	MaterialTypeID int        `json:"material_type_id"`
	TypeCode       string     `json:"type_code"`
	TypeName       string     `json:"type_name"`
	Unit           string     `json:"unit"`
	VariantID      *int       `json:"variant_id,omitempty"`
	VariantName    *string    `json:"variant_name,omitempty"`
	Color          string     `json:"color"`
	QtyReceived    Milli      `json:"qty_received"`
	QtyRemaining   Milli      `json:"qty_remaining"`
	UnitCost       *Milli     `json:"unit_cost,omitempty"`
	Supplier       *string    `json:"supplier,omitempty"`
	Note           *string    `json:"note,omitempty"`
	IsActive       bool       `json:"is_active"`
	ReceivedAt     time.Time  `json:"received_at"`
	CreatedAt      time.Time  `json:"created_at"`
	LastMovementAt *time.Time `json:"last_movement_at,omitempty"`
}

type Movement struct {
	ID              uuid.UUID  `json:"id"`
	CreatedAt       time.Time  `json:"created_at"`
	Kind            string     `json:"kind"`
	Qty             Milli      `json:"qty"`
	Reason          *string    `json:"reason,omitempty"`
	LotID           *uuid.UUID `json:"lot_id,omitempty"`
	LotCode         *string    `json:"lot_code,omitempty"`
	Color           *string    `json:"color,omitempty"`
	MaterialTypeID  int        `json:"material_type_id"`
	TypeCode        string     `json:"type_code"`
	TypeName        string     `json:"type_name"`
	Unit            string     `json:"unit"`
	VariantID       *int       `json:"variant_id,omitempty"`
	VariantName     *string    `json:"variant_name,omitempty"`
	BatchID         *uuid.UUID `json:"batch_id,omitempty"`
	BatchCode       *string    `json:"batch_code,omitempty"`
	PhaseLogID      *uuid.UUID `json:"phase_log_id,omitempty"`
	ActorUserID     *uuid.UUID `json:"actor_user_id,omitempty"`
	ActorUserName   *string    `json:"actor_user_name,omitempty"`
	ActorWorkerID   *uuid.UUID `json:"actor_worker_id,omitempty"`
	ActorWorkerName *string    `json:"actor_worker_name,omitempty"`
}

type MovementPage struct {
	Items      []Movement `json:"items"`
	NextCursor *string    `json:"next_cursor,omitempty"`
}

// ───── inputs ─────

type TypeInput struct {
	Code        *string    `json:"code"`
	Name        *string    `json:"name"`
	Unit        *string    `json:"unit"`
	HasVariants *bool      `json:"has_variants"`
	MinLevel    Opt[Milli] `json:"min_level"`
	Sort        *int       `json:"sort"`
	IsActive    *bool      `json:"is_active"`
}

type VariantInput struct {
	Name     *string          `json:"name"`
	Specs    *json.RawMessage `json:"specs"`
	IsActive *bool            `json:"is_active"`
}

type ReceiveInput struct {
	MaterialTypeID int     `json:"material_type_id"`
	VariantID      *int    `json:"variant_id"`
	LotCode        string  `json:"lot_code"`
	Color          string  `json:"color"`
	Qty            Milli   `json:"qty"`
	UnitCost       *Milli  `json:"unit_cost"`
	Supplier       *string `json:"supplier"`
	Note           *string `json:"note"`
}

type AdjustInput struct {
	NewRemaining *Milli `json:"new_remaining"`
	Reason       string `json:"reason"`
}

type QtyReasonInput struct {
	Qty    Milli  `json:"qty"`
	Reason string `json:"reason"`
}

type LotPatch struct {
	IsActive       *bool       `json:"is_active"`
	Color          *string     `json:"color"`
	Supplier       Opt[string] `json:"supplier"`
	Note           Opt[string] `json:"note"`
	UnitCost       Opt[Milli]  `json:"unit_cost"`
	MaterialTypeID *int        `json:"material_type_id"`
	VariantID      Opt[int]    `json:"variant_id"`
}

type MovementFilter struct {
	LotID   *uuid.UUID
	TypeID  *int
	BatchID *uuid.UUID
	From    *time.Time
	To      *time.Time // exclusive
	Limit   int
	Cursor  string
}

// Actor is the admin user making a change.
type Actor struct {
	UserID uuid.UUID
	Role   string
	IP     string
}
