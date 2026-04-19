package handlers

import (
	"context"
	"strings"
	"time"

	"zhblogs.net/src/store"
)

func (s *Service) handleUpstreamSync(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
) (map[string]any, string, error) {
	sources, summary, err := s.prepareUpstreamSyncResume(ctx, job.ID, payload.SourceID)
	if err != nil {
		return nil, "UPSTREAM_SOURCE_LOAD_FAILED", err
	}

	for _, source := range sources {
		if err = ctx.Err(); err != nil {
			return nil, "", err
		}
		if err = s.runUpstreamSyncSource(ctx, runtime, job, payload, source, summary); err != nil {
			return nil, "UPSTREAM_SYNC_RUN_FAILED", err
		}
	}

	return summary.output(), "", nil
}

func (s *Service) prepareUpstreamSyncResume(
	ctx context.Context,
	jobID string,
	sourceID string,
) ([]store.UpstreamSourceRecord, *upstreamSyncProgress, error) {
	sources, err := s.store.LoadEnabledUpstreamSources(ctx)
	if err != nil {
		return nil, nil, err
	}

	records, err := s.store.LoadUpstreamSyncResumeRecords(ctx, jobID)
	if err != nil {
		return nil, nil, err
	}

	progress := buildUpstreamSyncProgress(records, len(filterUpstreamSources(sources, sourceID)))
	completed := makeCompletedLookup(records, func(record store.UpstreamSyncResumeRecord) string { return record.SourceID })
	return filterPendingUpstreamSources(sources, sourceID, completed), progress, nil
}

func (s *Service) runUpstreamSyncSource(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
	source store.UpstreamSourceRecord,
	progress *upstreamSyncProgress,
) error {
	startedAt := time.Now().UTC()
	requestConfig, err := s.resolveRequestConfig(ctx, job, payload, source.RequestConfigID, "UPSTREAM_SYNC")
	if err != nil {
		progress.failedCount++
		return s.persistUpstreamProgress(ctx, job.ID, progress)
	}

	logUpstreamSyncStart(ctx, runtime, source, requestConfig.ID)
	finishedAt := finishedNow(startedAt)
	row := store.UpstreamSyncRunRow{
		JobID:           job.ID,
		SourceID:        source.ID,
		RequestConfigID: requestConfig.ID,
		DurationMS:      optionalInt(int(finishedAt.Sub(startedAt).Milliseconds())),
		SummaryPayload: map[string]any{
			"adapter_key": source.AdapterKey,
			"base_url":    source.BaseURL,
			"source_key":  source.SourceKey,
		},
		StartedTime:  startedAt,
		FinishedTime: &finishedAt,
	}
	if err = s.store.InsertUpstreamSyncRun(ctx, row); err != nil {
		return err
	}

	progress.succeededCount++
	return s.persistUpstreamProgress(ctx, job.ID, progress)
}

type upstreamSyncProgress struct {
	totalCount     int
	succeededCount int
	failedCount    int
}

func buildUpstreamSyncProgress(
	records []store.UpstreamSyncResumeRecord,
	totalCount int,
) *upstreamSyncProgress {
	progress := &upstreamSyncProgress{totalCount: totalCount}
	for _, record := range records {
		if strings.TrimSpace(record.ErrorCode) == "" {
			progress.succeededCount++
			continue
		}
		progress.failedCount++
	}
	return progress
}

func (p *upstreamSyncProgress) output() map[string]any {
	return map[string]any{
		"task":            "UPSTREAM_SYNC",
		"source_count":    p.totalCount,
		"succeeded_count": p.succeededCount,
		"failed_count":    p.failedCount,
	}
}

func filterPendingUpstreamSources(
	sources []store.UpstreamSourceRecord,
	sourceID string,
	completed map[string]struct{},
) []store.UpstreamSourceRecord {
	filtered := make([]store.UpstreamSourceRecord, 0, len(sources))
	for _, source := range filterUpstreamSources(sources, sourceID) {
		if _, exists := completed[source.ID]; exists {
			continue
		}
		filtered = append(filtered, source)
	}
	return filtered
}

func filterUpstreamSources(
	sources []store.UpstreamSourceRecord,
	sourceID string,
) []store.UpstreamSourceRecord {
	filtered := make([]store.UpstreamSourceRecord, 0, len(sources))
	for _, source := range sources {
		if strings.TrimSpace(sourceID) != "" && source.ID != strings.TrimSpace(sourceID) {
			continue
		}
		filtered = append(filtered, source)
	}
	return filtered
}

func logUpstreamSyncStart(
	ctx context.Context,
	runtime Runtime,
	source store.UpstreamSourceRecord,
	requestConfigID string,
) {
	runtime.Log(ctx, "INFO", "upstream.sync.start", "start upstream sync", map[string]any{
		"source_id":         source.ID,
		"source_key":        source.SourceKey,
		"adapter_key":       source.AdapterKey,
		"request_config_id": requestConfigID,
	})
}

func (s *Service) persistUpstreamProgress(
	ctx context.Context,
	jobID string,
	progress *upstreamSyncProgress,
) error {
	return s.store.UpdateRunningJobResult(ctx, jobID, progress.output())
}

func finishedNow(startedAt time.Time) time.Time {
	finishedAt := time.Now().UTC()
	if finishedAt.Before(startedAt) {
		finishedAt = startedAt
	}
	return finishedAt
}
