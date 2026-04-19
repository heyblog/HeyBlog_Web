package store

import (
	"context"
	"encoding/json"
	"fmt"
)

func (s *Store) LoadRequestConfig(ctx context.Context, requestConfigID string) (*RequestConfigRecord, error) {
	row := s.pool.QueryRow(ctx, `
select
	id,
	name,
	task_type,
	user_agent,
	timeout_ms,
	retry_max,
	retry_strategy,
	retry_base_delay_ms,
	retry_max_delay_ms,
	backoff_factor,
	jitter_ratio,
	wait_between_requests_ms,
	follow_redirects,
	default_headers::text
from request_configs
where id = $1
	and is_enabled = true
`, requestConfigID)

	var result RequestConfigRecord
	var headerText string
	if err := row.Scan(
		&result.ID,
		&result.Name,
		&result.TaskType,
		&result.UserAgent,
		&result.TimeoutMS,
		&result.RetryMax,
		&result.RetryStrategy,
		&result.RetryBaseDelayMS,
		&result.RetryMaxDelayMS,
		&result.BackoffFactor,
		&result.JitterRatio,
		&result.WaitBetweenRequestsMS,
		&result.FollowRedirects,
		&headerText,
	); err != nil {
		return nil, fmt.Errorf("load request config: %w", err)
	}

	result.DefaultHeaders = map[string]string{}
	if headerText != "" {
		_ = json.Unmarshal([]byte(headerText), &result.DefaultHeaders)
	}

	return &result, nil
}
