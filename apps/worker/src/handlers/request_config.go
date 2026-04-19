package handlers

import (
	"context"
	"fmt"

	"zhblogs.net/src/store"
)

func (s *Service) resolveRequestConfig(
	ctx context.Context,
	job store.JobRecord,
	payload JobPayload,
	fallbackID string,
	taskType string,
) (*store.RequestConfigRecord, error) {
	requestConfigID := chooseFirstNonEmpty(payload.RequestConfigID, job.RequestConfigID, fallbackID)
	if requestConfigID == "" {
		return nil, fmt.Errorf("request_config_id is required")
	}

	requestConfig, err := s.store.LoadRequestConfig(ctx, requestConfigID)
	if err != nil {
		return nil, err
	}

	if requestConfig.TaskType != taskType {
		return nil, fmt.Errorf("request config task_type mismatch: expected=%s actual=%s", taskType, requestConfig.TaskType)
	}

	return requestConfig, nil
}
