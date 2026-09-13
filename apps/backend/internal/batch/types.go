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

	UnitPending              UnitStatus = "pending"
	UnitPacked               UnitStatus = "packed"
	UnitDefective            UnitStatus = "defective"
	UnitDispatched           UnitStatus = "dispatched"
	StatusAwaitingAssignment Status     = "awaiting_assignment"
)

// Batch is the production order, with denormalized display fields.
type Batch struct {
	ID            uuid.UUID  `json:"id"`
	BatchCode     string     `json:"batch_code"`
	CarModelID    int        `json:"car_model_id"`
	BrandName     string     `json:"brand_name"`
	ModelName     string     `json:"model_name"`
	SizeClass     string     `json:"size_class"`
	RollID        *uuid.UUID `json:"roll_id,omitempty"`
	RollCode      *string    `json:"roll_code,omitempty"`
	Quantity      int        `json:"quantity"`
	CurrentPhase  Phase      `json:"current_phase"`
	Status        Status     `json:"status"`
	Notes         string     `json:"notes,omitempty"`
	ReworkCount   int        `json:"rework_count"`
	CreatedBy     uuid.UUID  `json:"created_by"`
	CreatedByName string     `json:"created_by_name,omitempty"`
	Version       int        `json:"version"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`

	// Unit roll-up (populated on detail/list)
	UnitsTotal    int `json:"units_total"`
	UnitsPacked   int `json:"units_packed"`
	UnitsStitched int `json:"units_stitched"`
	// Open claim on the current phase, if any
	ActiveWorkers     *string    `json:"active_workers,omitempty"` // "Surya, Mahesh"
	JoinedByMe        bool       `json:"joined_by_me"`
	AssignedWorkers   *string    `json:"assigned_workers,omitempty"`
	AssignedToMe      bool       `json:"assigned_to_me"`
	StickersPrintedAt *time.Time `json:"stickers_printed_at,omitempty"`
	// Batch — add (worker-queue payload):
	MyTargetQty *int `json:"my_target_qty,omitempty"`
	MyDoneQty   int  `json:"my_done_qty"`
}

// Unit is one physical mat.
type Unit struct {
	ID             uuid.UUID  `json:"id"`
	BatchID        uuid.UUID  `json:"batch_id"`
	UnitCode       string     `json:"unit_code"`
	UnitNumber     int        `json:"unit_number"`
	Status         UnitStatus `json:"status"`
	PackedAt       *time.Time `json:"packed_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	StitchedAt     *time.Time `json:"stitched_at,omitempty"`
	StitchedByName *string    `json:"stitched_by_name,omitempty"`
	PackedByName   *string    `json:"packed_by_name,omitempty"`
}

type BatchDetail struct {
	Batch
	Units       []Unit            `json:"units"`
	Timeline    []PhaseLogEntry   `json:"timeline"`
	Assignments []AssignmentEntry `json:"assignments"`
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

// PhaseLogEntry is one row of a batch's production history.
type PhaseLogEntry struct {
	ID                uuid.UUID  `json:"id"`
	Phase             Phase      `json:"phase"`
	WorkerID          uuid.UUID  `json:"worker_id"`
	WorkerName        string     `json:"worker_name"`
	StartedAt         time.Time  `json:"started_at"`
	CompletedAt       *time.Time `json:"completed_at,omitempty"`
	DurationSeconds   *int       `json:"duration_seconds,omitempty"`
	QuantityCompleted *int       `json:"quantity_completed,omitempty"`
	Notes             string     `json:"notes,omitempty"`
}

// ScanResult tells the scanner app what happened + progress.
type ScanResult struct {
	UnitCode       string `json:"unit_code"`
	BatchCode      string `json:"batch_code"`
	Phase          Phase  `json:"phase"` // stitching | packing
	AlreadyDone    bool   `json:"already_done"`
	DoneCount      int    `json:"done_count"`
	TotalUnits     int    `json:"total_units"`
	PhaseCompleted bool   `json:"phase_completed"` // stitching → packing
	BatchCompleted bool   `json:"batch_completed"` // packing → done
}

// AssignmentInput — one assignee + optional quota (nil = uncapped).
type AssignmentInput struct {
	WorkerID  uuid.UUID
	TargetQty *int
}

type AssignmentEntry struct {
	Phase      Phase     `json:"phase"`
	WorkerID   uuid.UUID `json:"worker_id"`
	WorkerName string    `json:"worker_name"`
	TargetQty  *int      `json:"target_qty,omitempty"`
	DoneQty    int       `json:"done_qty"`
}
