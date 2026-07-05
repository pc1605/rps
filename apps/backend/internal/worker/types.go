package worker

import (
	"time"

	"github.com/google/uuid"
)

type Station string

const (
	StationCutter   Station = "cutter"
	StationStitcher Station = "stitcher"
	StationPacker   Station = "packer"
)

type Worker struct {
	ID            uuid.UUID  `json:"id"`
	Name          string     `json:"name"`
	Phone         string     `json:"phone,omitempty"`
	Station       Station    `json:"station"`
	IsActive      bool       `json:"is_active"`
	LastLoginAt   *time.Time `json:"last_login_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	// BadgeToken is only returned once, at creation, for printing the badge.
	BadgeToken    string     `json:"badge_token,omitempty"`
}

type CreateInput struct {
	Name    string `json:"name"`
	Phone   string `json:"phone,omitempty"`
	Station string `json:"station"`
	PIN     string `json:"pin"` // 4-digit
}

type LoginInput struct {
	BadgeToken string `json:"badge_token"`
	PIN        string `json:"pin"`
	DeviceID   string `json:"device_id,omitempty"`
}