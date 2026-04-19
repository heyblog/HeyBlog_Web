package store

import "time"

type JobRecord struct {
	ID               string
	ScheduleID       string
	TaskType         string
	TriggerSource    string
	Payload          []byte
	RequestConfigID  string
	RetryRootJobID   string
	RetryParentJobID string
	RetrySequence    int
}

type JobExecutionState struct {
	CancelRequested bool
	CancelReason    string
}

type SiteCheckResumeRecord struct {
	SiteID        string
	Status        string
	DerivedStatus string
	ErrorMessage  string
}

type RSSFetchResumeRecord struct {
	SiteID       string
	Status       string
	FeedURL      string
	ErrorMessage string
}

type UpstreamSyncResumeRecord struct {
	SourceID     string
	ErrorCode    string
	ErrorMessage string
}

type JobCounts struct {
	Pending int
	Running int
}

type ScheduleRecord struct {
	ID              string
	Name            string
	TaskType        string
	ScheduleMode    string
	RequestConfigID string
	ScheduleConfig  []byte
	PayloadTemplate []byte
	NextRunTime     *time.Time
}

type RequestConfigRecord struct {
	ID                    string
	Name                  string
	TaskType              string
	UserAgent             string
	TimeoutMS             int
	RetryMax              int
	RetryStrategy         string
	RetryBaseDelayMS      int
	RetryMaxDelayMS       int
	BackoffFactor         int
	JitterRatio           int
	WaitBetweenRequestsMS int
	FollowRedirects       bool
	DefaultHeaders        map[string]string
}

type SiteTarget struct {
	ID          string
	Name        string
	URL         string
	AccessScope string
	Sitemap     string
	LinkPage    string
	Feed        []SiteFeedConfig
}

type SiteFeedConfig struct {
	Name      string `json:"name"`
	URL       string `json:"url"`
	Type      string `json:"type"`
	IsDefault bool   `json:"isDefault"`
}

type FeedArticleRow struct {
	GUID       string
	ArticleURL string
	Title      string
	Summary    string
	FeedType   string
	Source     map[string]any
	Published  *time.Time
}

type SiteCheckRunRow struct {
	JobID                    string
	SiteID                   string
	RequestConfigID          string
	Status                   string
	AvailabilityResult       string
	VerifyResult             string
	EffectiveAccessScope     string
	DerivedAccessScope       string
	DerivedStatus            string
	CheckMode                string
	ContentValidationStatus  string
	ContentValidationPayload map[string]any
	ProbeSummary             []map[string]any
	ResponseTimeMS           *int
	DurationMS               *int
	JitterMS                 *int
	FinalURL                 string
	ErrorCode                string
	ErrorMessage             string
	StartedTime              time.Time
	FinishedTime             *time.Time
}

type RSSFetchRunRow struct {
	JobID                string
	SiteID               string
	RequestConfigID      string
	Status               string
	FeedURL              string
	FeedFormat           string
	SourceKind           string
	EffectiveAccessScope string
	NetworkPath          string
	FallbackUsed         bool
	ArticleCount         int
	UpsertedCount        int
	SkippedCount         int
	ErrorCode            string
	ErrorMessage         string
	SummaryPayload       map[string]any
	StartedTime          time.Time
	FinishedTime         *time.Time
}

type UpstreamSourceRecord struct {
	ID              string
	SourceKey       string
	Label           string
	BaseURL         string
	AdapterKey      string
	RequestConfigID string
}

type UpstreamSyncRunRow struct {
	JobID            string
	SourceID         string
	RequestConfigID  string
	NewSiteCount     int
	UpdatedSiteCount int
	SkippedCount     int
	DurationMS       *int
	ErrorCode        string
	ErrorMessage     string
	SummaryPayload   map[string]any
	StartedTime      time.Time
	FinishedTime     *time.Time
}
