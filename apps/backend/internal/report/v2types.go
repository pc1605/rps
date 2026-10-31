package report

import (
	"time"

	"github.com/google/uuid"
)

// Reports v2 (R1). Days are factory-local (FACTORY_TZ); ranges are [from, to) instants.

type Range struct {
	From string `json:"from"` // inclusive day, YYYY-MM-DD
	To   string `json:"to"`   // inclusive day
}

type DayCount struct {
	Day      string `json:"day"`
	Cut      int    `json:"cut"`
	Stitched int    `json:"stitched"`
	Packed   int    `json:"packed"`
}

type Totals struct {
	Cut      int `json:"cut"`
	Stitched int `json:"stitched"`
	Packed   int `json:"packed"`
}

// Stage = where a live batch sits: cutting · awaiting_assignment · stitching · packing.
type WipStage struct {
	Stage   string `json:"stage"`
	Batches int    `json:"batches"`
	Mats    int    `json:"mats"`
	// Batches by time since entering the stage: <4 h, 4–24 h, 1–3 d, >3 d.
	Ageing [4]int `json:"ageing"`
	Stuck  int    `json:"stuck"`
}

type FpyWeek struct {
	Week      string `json:"week"` // Monday, YYYY-MM-DD
	Packed    int    `json:"packed"`
	FirstPass int    `json:"first_pass"`
}

type ItemMix struct {
	CarModelID  int     `json:"car_model_id"`
	CarName     string  `json:"car_name"`
	ProductLine *string `json:"product_line,omitempty"`
	Packed      int     `json:"packed"`
}

type Overview struct {
	Range      Range      `json:"range"`
	Days       []DayCount `json:"days"`
	Totals     Totals     `json:"totals"`
	Previous   Totals     `json:"previous"` // the same number of days just before `from`
	Wip        []WipStage `json:"wip"`
	StuckCount int        `json:"stuck_count"`
	// First-pass yield: mats packed in range with no rework round / mats packed.
	FpyPacked    int        `json:"fpy_packed"`
	FpyFirstPass int        `json:"fpy_first_pass"`
	FpyWeeks     []FpyWeek  `json:"fpy_weeks"`
	Items        []ItemMix  `json:"items"`
	StuckHours   StuckHours `json:"stuck_hours"`
}

type StuckBatch struct {
	BatchID        uuid.UUID `json:"batch_id"`
	BatchCode      string    `json:"batch_code"`
	CarName        string    `json:"car_name"`
	Quantity       int       `json:"quantity"`
	Stage          string    `json:"stage"`
	EnteredAt      time.Time `json:"entered_at"`
	LastActivityAt time.Time `json:"last_activity_at"`
	IdleHours      float64   `json:"idle_hours"`
	ThresholdHours int       `json:"threshold_hours"`
}

type WorkerOutput struct {
	WorkerID   uuid.UUID `json:"worker_id"`
	WorkerName string    `json:"worker_name"`
	Station    string    `json:"station"`
	IsActive   bool      `json:"is_active"`
	Mats       int       `json:"mats"`        // cutters: pieces cut; stitchers/packers: mats scanned
	DaysWorked int       `json:"days_worked"` // days with any output
	// Cutters: time between start and complete. Others: first → last scan per day, summed.
	ActiveSecs  int      `json:"active_secs"`
	MatsPerHour *float64 `json:"mats_per_hour,omitempty"` // only with ≥ 15 min active
	// Stitchers only.
	ReworkRounds  int `json:"rework_rounds"`
	QuotaTarget   int `json:"quota_target"`
	QuotaDone     int `json:"quota_done"`
	QuotaBatches  int `json:"quota_batches"`
	CurrentlyOpen int `json:"currently_open"` // open claims right now
}

type ReasonCount struct {
	Reason string `json:"reason"`
	Count  int    `json:"count"`
}

type StitcherRework struct {
	WorkerID   uuid.UUID `json:"worker_id"`
	WorkerName string    `json:"worker_name"`
	Rounds     int       `json:"rounds"`
	Stitched   int       `json:"stitched"` // mats they stitched in range
}

type ShortCount struct {
	Action string `json:"action"`
	Reason string `json:"reason"`
	Count  int    `json:"count"`
}

type LossRow struct {
	Decision   string `json:"decision"` // write_off | recut
	CarModelID int    `json:"car_model_id"`
	CarName    string `json:"car_name"`
	Count      int    `json:"count"`
}

type Quality struct {
	Range          Range            `json:"range"`
	ReworkRounds   int              `json:"rework_rounds"`
	ByReason       []ReasonCount    `json:"by_reason"`
	ByStitcher     []StitcherRework `json:"by_stitcher"`
	FixedCount     int              `json:"fixed_count"`
	AvgFixHours    *float64         `json:"avg_fix_hours,omitempty"`
	CutCompletions int              `json:"cut_completions"`
	ShortCuts      []ShortCount     `json:"short_cuts"`
	Losses         []LossRow        `json:"losses"`
	LossByReason   []ReasonCount    `json:"loss_by_reason"`
}
