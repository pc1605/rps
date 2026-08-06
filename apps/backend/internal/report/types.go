package report

import "github.com/google/uuid"

type WorkerProductivity struct {
	WorkerID        uuid.UUID `json:"worker_id"`
	WorkerName      string    `json:"worker_name"`
	Station         string    `json:"station"`
	IsActive        bool      `json:"is_active"`
	BatchesDone     int       `json:"batches_done"`
	PiecesDone      int       `json:"pieces_done"`
	AvgDurationSecs int       `json:"avg_duration_secs"`
	// An open claim right now?
	CurrentlyWorking bool `json:"currently_working"`
}