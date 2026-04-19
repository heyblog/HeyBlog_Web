package handlers

import "context"

type Runtime interface {
	Log(ctx context.Context, level string, eventKey string, message string, payload map[string]any)
	WorkerID() string
}

type JobTarget struct {
	Kind    string   `json:"kind"`
	SiteID  string   `json:"site_id"`
	SiteIDs []string `json:"site_ids"`
}

type JobOptions struct {
	RunContentValidation bool     `json:"run_content_validation"`
	RunGlobalCheck       bool     `json:"run_global_check"`
	RunFullCheck         bool     `json:"run_full_check"`
	Source               string   `json:"source"`
	FeedMode             string   `json:"feed_mode"`
	FeedURLs             []string `json:"feed_urls"`
}

type JobPayload struct {
	SourceID        string                 `json:"source_id"`
	RequestConfigID string                 `json:"request_config_id"`
	Target          JobTarget              `json:"target"`
	Options         JobOptions             `json:"options"`
	ExtraOptions    map[string]interface{} `json:"-"`
}

type ProbeResult struct {
	Result         string
	StatusCode     int
	ResponseTimeMS int
	DurationMS     int
	FinalURL       string
	ContentVerify  bool
	Message        string
	Body           []byte
}
