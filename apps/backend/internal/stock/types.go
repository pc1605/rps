package stock

import (
	"time"

	"github.com/google/uuid"
)

const LowStockMeters = 10.0

type Roll struct{
	ID uuid.UUID `json:"id"`
	RollCode        string    `json:"roll_code"`
	Color string `json:"color"`
	TotalMeters float64 `json:"total_meters"`
	RemainingMeters float64 `json:"remaining_meters"`
	IsActive bool `json:"is_active"`
	IsLow bool `json:"is_low"`
	ReceivedAt time.Time `json:"received_at"`
	CreatedAt time.Time `json:"created_at"`
	BatchCount int `json:"batch_count"`
}

type CreateRollInput struct {
	RollCode    string  `json:"roll_code"`
	Color       string  `json:"color"`
	TotalMeters float64 `json:"total_meters"`
}

// UpdateRollInput — pointer fields: only provided ones change.
type UpdateRollInput struct {
	Color           *string  `json:"color,omitempty"`
	TotalMeters     *float64 `json:"total_meters,omitempty"`
	RemainingMeters *float64 `json:"remaining_meters,omitempty"`
	IsActive        *bool    `json:"is_active,omitempty"`
}

type FinishedStock struct {
	CarModelID int    `json:"car_model_id"`
	BrandName  string `json:"brand_name"`
	ModelName  string `json:"model_name"`
	SizeClass  string `json:"size_class"`
	PackedCount int   `json:"packed_count"`
}