// Package push sends phone notifications through Firebase Cloud Messaging (N1, D47).
package push

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// Message is one notification for one phone.
type Message struct {
	Token string
	Title string
	Body  string
	Data  map[string]string // what the app opens when the notification is tapped
}

// Sender delivers one message.
type Sender interface {
	Send(ctx context.Context, m Message) error
}

// ErrUnregistered: the phone's token is no longer valid (app removed or data cleared) — forget it.
var ErrUnregistered = errors.New("push token no longer registered")

// ChannelID is the Android notification channel the app creates (lib/notifications.ts). Must match.
const ChannelID = "work"

const fcmScope = "https://www.googleapis.com/auth/firebase.messaging"

// FCM sends through the Firebase Cloud Messaging HTTP v1 API with a service-account key.
type FCM struct {
	client   *http.Client
	endpoint string
}

// NewFCM reads a Firebase service-account key (the JSON file from Firebase → Project settings →
// Service accounts). The project is taken from the key.
func NewFCM(ctx context.Context, serviceAccountJSON []byte) (*FCM, error) {
	creds, err := google.CredentialsFromJSON(ctx, serviceAccountJSON, fcmScope)
	if err != nil {
		return nil, fmt.Errorf("firebase key: %w", err)
	}
	if creds.ProjectID == "" {
		return nil, errors.New("firebase key has no project_id")
	}
	client := oauth2.NewClient(ctx, creds.TokenSource)
	client.Timeout = 10 * time.Second
	return &FCM{
		client:   client,
		endpoint: "https://fcm.googleapis.com/v1/projects/" + creds.ProjectID + "/messages:send",
	}, nil
}

type fcmRequest struct {
	Message fcmMessage `json:"message"`
}

type fcmMessage struct {
	Token        string            `json:"token"`
	Notification fcmNotification   `json:"notification"`
	Data         map[string]string `json:"data,omitempty"`
	Android      fcmAndroid        `json:"android"`
}

type fcmNotification struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

type fcmAndroid struct {
	Priority     string                 `json:"priority"`
	Notification fcmAndroidNotification `json:"notification"`
}

type fcmAndroidNotification struct {
	ChannelID string `json:"channel_id"`
	Sound     string `json:"sound"`
}

type fcmError struct {
	Error struct {
		Status  string `json:"status"`
		Message string `json:"message"`
		Details []struct {
			ErrorCode string `json:"errorCode"`
		} `json:"details"`
	} `json:"error"`
}

// Send posts one message. A dead token comes back as ErrUnregistered.
func (f *FCM) Send(ctx context.Context, m Message) error {
	body, err := json.Marshal(fcmRequest{Message: fcmMessage{
		Token:        m.Token,
		Notification: fcmNotification{Title: m.Title, Body: m.Body},
		Data:         m.Data,
		Android: fcmAndroid{
			Priority:     "high",
			Notification: fcmAndroidNotification{ChannelID: ChannelID, Sound: "default"},
		},
	}})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, f.endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := f.client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode == http.StatusOK {
		_, _ = io.Copy(io.Discard, res.Body)
		return nil
	}
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	var e fcmError
	_ = json.Unmarshal(raw, &e)
	for _, d := range e.Error.Details {
		if d.ErrorCode == "UNREGISTERED" {
			return ErrUnregistered
		}
	}
	return fmt.Errorf("fcm: %d %s: %s", res.StatusCode, e.Error.Status, e.Error.Message)
}
