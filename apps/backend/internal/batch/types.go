package batch

import (
	"time"

	"github.com/google/uuid"
)

type Phase string
type Status string
type UnitStatus string

const (
	PhaseCutting   Phase = "cutting"
	PhaseStitching Phase = "stitching"
	PhasePacking   Phase = "packing"
	PhaseCompleted Phase = "completed"

	StatusPending    Status = "pending"
	StatusInProgress Status = "in_progress"
	StatusCompleted  Status = "completed"
	StatusCancelled  Status = "cancelled"

	UnitPending    UnitStatus = "pending"
	UnitPacked     UnitStatus = "packed"
	UnitDefective  UnitStatus = "defective"
	UnitDispatched UnitStatus = "dispatched"
)

// Batch is the production order, with denormalized display fields.
type Batch struct {
	ID           uuid.UUID  `json:"id"`
	BatchCode    string     `json:"batch_code"`
	CarModelID   int        `json:"car_model_id"`
	BrandName    string     `json:"brand_name"`
	ModelName    string     `json:"model_name"`
	SizeClass    string     `json:"size_class"`
	RollID       *uuid.UUID `json:"roll_id,omitempty"`
	RollCode     *string    `json:"roll_code,omitempty"`
	Quantity     int        `json:"quantity"`
	CurrentPhase Phase      `json:"current_phase"`
	Status       Status     `json:"status"`
	Notes        string     `json:"notes,omitempty"`
	ReworkCount  int        `json:"rework_count"`
	CreatedBy    uuid.UUID  `json:"created_by"`
	CreatedByName string    `json:"created_by_name,omitempty"`
	Version      int        `json:"version"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`

	// Unit roll-up (populated on detail/list)
	UnitsTotal  int `json:"units_total"`
	UnitsPacked int `json:"units_packed"`
	// Open claim on the current phase, if any
	ActiveWorkerID   *uuid.UUID `json:"active_worker_id,omitempty"`
	ActiveWorkerName *string    `json:"active_worker_name,omitempty"`
}

// Unit is one physical mat.
type Unit struct {
	ID         uuid.UUID  `json:"id"`
	BatchID    uuid.UUID  `json:"batch_id"`
	UnitCode   string     `json:"unit_code"`
	UnitNumber int        `json:"unit_number"`
	Status     UnitStatus `json:"status"`
	PackedAt   *time.Time `json:"packed_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// BatchDetail is a batch plus its units.
type BatchDetail struct {
	Batch
	Units []Unit `json:"units"`
}

// CreateInput is the request body for creating a batch.
type CreateInput struct {
	CarModelID int     `json:"car_model_id"`
	RollID     *string `json:"roll_id,omitempty"`
	Quantity   int     `json:"quantity"`
	Notes      string  `json:"notes,omitempty"`
}

// PhaseForStation maps a worker's station to the phase they operate.
var PhaseForStation = map[string]Phase{
	"cutter":   PhaseCutting,
	"stitcher": PhaseStitching,
	"packer":   PhasePacking,
}