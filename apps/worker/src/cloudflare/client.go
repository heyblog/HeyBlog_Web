package cloudflare

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"zhblogs.net/src/config"
)

type CheckResponse struct {
	OK   bool `json:"ok"`
	Data struct {
		Result         string `json:"result"`
		StatusCode     int    `json:"status_code"`
		ResponseTimeMS int    `json:"response_time_ms"`
		DurationMS     int    `json:"duration_ms"`
		FinalURL       string `json:"final_url"`
		ContentVerify  bool   `json:"content_verified"`
		Message        string `json:"message"`
	} `json:"data"`
}

func (r CheckResponse) IsOK() bool {
	return r.OK
}

type RSSResponse struct {
	OK   bool `json:"ok"`
	Data struct {
		Result       string `json:"result"`
		ArticleCount int    `json:"article_count"`
		FinalURL     string `json:"final_url"`
		ContentType  string `json:"content_type"`
		Content      string `json:"content"`
		Message      string `json:"message"`
	} `json:"data"`
}

func (r RSSResponse) IsOK() bool {
	return r.OK
}

type Client struct {
	baseURL string
	token   string
	client  *http.Client
}

type responseEnvelope interface {
	IsOK() bool
}

func New(cfg config.Config) *Client {
	if strings.TrimSpace(cfg.CloudflareURL) == "" || strings.TrimSpace(cfg.CloudflareToken) == "" {
		return nil
	}

	return &Client{
		baseURL: strings.TrimRight(cfg.CloudflareURL, "/"),
		token:   cfg.CloudflareToken,
		client: &http.Client{
			Timeout: cfg.CallbackTimeout,
		},
	}
}

func (c *Client) Check(ctx context.Context, targetURL string) (*CheckResponse, error) {
	if c == nil {
		return nil, fmt.Errorf("cloudflare client is disabled")
	}

	return sendJSON[CheckResponse](ctx, c, "/check", map[string]any{
		"url": targetURL,
	})
}

func (c *Client) FetchRSS(ctx context.Context, feedURL string) (*RSSResponse, error) {
	if c == nil {
		return nil, fmt.Errorf("cloudflare client is disabled")
	}

	return sendJSON[RSSResponse](ctx, c, "/rss/fetch", map[string]any{
		"feed_url": feedURL,
	})
}

func sendJSON[T responseEnvelope](
	ctx context.Context,
	client *Client,
	path string,
	payload map[string]any,
) (*T, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal request payload: %w", err)
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		client.baseURL+path,
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}

	request.Header.Set("authorization", "Bearer "+client.token)
	request.Header.Set("content-type", "application/json")
	request.Header.Set("accept", "application/json")

	response, err := client.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("call cloudflare endpoint: %w", err)
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if response.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf(
			"cloudflare endpoint status=%d: %s",
			response.StatusCode,
			extractRemoteMessage(responseBody),
		)
	}

	var parsed T
	if err = json.Unmarshal(responseBody, &parsed); err != nil {
		return nil, fmt.Errorf(
			"decode response body: %w; body=%s",
			err,
			limitBody(string(responseBody), 320),
		)
	}

	if !parsed.IsOK() {
		return nil, fmt.Errorf("cloudflare endpoint returned ok=false: %s", extractRemoteMessage(responseBody))
	}

	return &parsed, nil
}

func extractRemoteMessage(body []byte) string {
	type remoteError struct {
		Message string `json:"message"`
		Error   struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	parsed := remoteError{}
	if err := json.Unmarshal(body, &parsed); err == nil {
		if strings.TrimSpace(parsed.Error.Message) != "" {
			return strings.TrimSpace(parsed.Error.Message)
		}
		if strings.TrimSpace(parsed.Message) != "" {
			return strings.TrimSpace(parsed.Message)
		}
	}

	return limitBody(string(body), 320)
}

func limitBody(value string, limit int) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) <= limit {
		return trimmed
	}

	return trimmed[:limit] + "..."
}
