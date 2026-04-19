package handlers

import (
	"context"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"time"

	"zhblogs.net/src/store"
)

type HTTPFetchResult struct {
	StatusCode     int
	ResponseTimeMS int
	DurationMS     int
	FinalURL       string
	ContentType    string
	Body           []byte
}

func fetchURL(ctx context.Context, targetURL string, config *store.RequestConfigRecord) (*HTTPFetchResult, error) {
	attempts := maxRequestAttempts(config)
	var lastErr error

	for attempt := 0; attempt < attempts; attempt++ {
		if attempt > 0 {
			if err := waitForRetry(ctx, requestRetryDelay(config, attempt)); err != nil {
				return nil, err
			}
		}

		result, err := doSingleRequest(ctx, targetURL, config)
		if !shouldRetryRequest(config, attempt, attempts, result, err) {
			return result, err
		}

		lastErr = err
		if err == nil && result != nil {
			lastErr = fmt.Errorf("retryable status=%d", result.StatusCode)
		}
	}

	return nil, lastErr
}

func doSingleRequest(
	ctx context.Context,
	targetURL string,
	config *store.RequestConfigRecord,
) (*HTTPFetchResult, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}

	applyRequestHeaders(request, config)
	client := buildHTTPClient(config)
	startedAt := time.Now()
	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, 1024*1024*2))
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	durationMS := int(time.Since(startedAt).Milliseconds())
	return &HTTPFetchResult{
		StatusCode:     response.StatusCode,
		ResponseTimeMS: durationMS,
		DurationMS:     durationMS,
		FinalURL:       response.Request.URL.String(),
		ContentType:    response.Header.Get("content-type"),
		Body:           body,
	}, nil
}

func buildHTTPClient(config *store.RequestConfigRecord) *http.Client {
	client := &http.Client{
		Timeout: time.Duration(config.TimeoutMS) * time.Millisecond,
	}

	if !config.FollowRedirects {
		client.CheckRedirect = func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		}
	}

	return client
}

func applyRequestHeaders(request *http.Request, config *store.RequestConfigRecord) {
	for key, value := range config.DefaultHeaders {
		request.Header.Set(key, value)
	}

	request.Header.Set("user-agent", config.UserAgent)
}

func shouldRetryRequest(
	config *store.RequestConfigRecord,
	attempt int,
	attempts int,
	result *HTTPFetchResult,
	err error,
) bool {
	if attempt >= attempts-1 {
		return false
	}

	if err != nil {
		return true
	}

	return result != nil && (result.StatusCode == http.StatusTooManyRequests || result.StatusCode >= 500)
}

func requestRetryDelay(config *store.RequestConfigRecord, attempt int) time.Duration {
	baseDelay := float64(config.RetryBaseDelayMS)
	maxDelay := float64(config.RetryMaxDelayMS)
	if baseDelay <= 0 {
		return 0
	}

	delay := baseDelay
	switch config.RetryStrategy {
	case "LINEAR":
		delay = baseDelay * float64(attempt+1)
	case "EXPONENTIAL":
		delay = baseDelay * math.Pow(float64(max(1, config.BackoffFactor)), float64(attempt))
	}

	if maxDelay > 0 && delay > maxDelay {
		delay = maxDelay
	}

	if config.JitterRatio > 0 {
		jitterRatio := float64(config.JitterRatio) / 100
		jitterRange := delay * jitterRatio
		delay += (rand.Float64()*2 - 1) * jitterRange
	}

	if delay < 0 {
		delay = 0
	}

	return time.Duration(delay) * time.Millisecond
}

func waitForRetry(ctx context.Context, delay time.Duration) error {
	if delay <= 0 {
		return nil
	}

	timer := time.NewTimer(delay)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func maxRequestAttempts(config *store.RequestConfigRecord) int {
	attempts := config.RetryMax + 1
	if attempts <= 0 {
		return 1
	}

	return attempts
}
