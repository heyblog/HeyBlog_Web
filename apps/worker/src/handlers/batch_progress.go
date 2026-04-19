package handlers

import (
	"context"
	"fmt"
	"time"
)

func (s *Service) collectSiteCheckResults(
	ctx context.Context,
	runtime Runtime,
	jobID string,
	progress *batchProgress,
	results <-chan siteCheckTargetResult,
	cancel context.CancelFunc,
) error {
	var persistErr error
	for result := range results {
		if persistErr != nil {
			continue
		}
		persistErr = s.persistSiteCheckResult(ctx, runtime, jobID, progress, result)
		if persistErr != nil {
			cancel()
		}
	}
	return persistErr
}

func (s *Service) collectRSSFetchResults(
	ctx context.Context,
	runtime Runtime,
	jobID string,
	progress *batchProgress,
	results <-chan rssFetchTargetResult,
	cancel context.CancelFunc,
) error {
	var persistErr error
	for result := range results {
		if persistErr != nil {
			continue
		}
		persistErr = s.persistRSSFetchResult(ctx, runtime, jobID, progress, result)
		if persistErr != nil {
			cancel()
		}
	}
	return persistErr
}

func (s *Service) persistSiteCheckResult(
	ctx context.Context,
	runtime Runtime,
	jobID string,
	progress *batchProgress,
	result siteCheckTargetResult,
) error {
	if err := s.store.InsertSiteCheckRun(ctx, result.row); err != nil {
		return err
	}

	progress.applySiteCheck(result)
	_ = s.store.UpdateRunningJobResult(ctx, jobID, progress.runningResult())
	s.logSiteCheckTargetCompleted(ctx, runtime, result, progress)
	return nil
}

func (s *Service) persistRSSFetchResult(
	ctx context.Context,
	runtime Runtime,
	jobID string,
	progress *batchProgress,
	result rssFetchTargetResult,
) error {
	if err := s.store.InsertRSSFetchRun(ctx, result.row); err != nil {
		return err
	}

	progress.applyRSSFetch(result)
	_ = s.store.UpdateRunningJobResult(ctx, jobID, progress.runningResult())
	s.logRSSFetchTargetCompleted(ctx, runtime, result, progress)
	return nil
}

func resolveBatchWorkerCount(configured int, total int) int {
	if configured <= 0 {
		configured = 1
	}
	if total <= 0 {
		return 1
	}
	if configured > total {
		return total
	}
	return configured
}

func newBatchProgress(totalCount int) *batchProgress {
	return &batchProgress{
		totalCount:     totalCount,
		failureSamples: make([]map[string]any, 0, 10),
	}
}

func (p *batchProgress) applySiteCheck(result siteCheckTargetResult) {
	p.processedCount++
	if result.resultErr == nil && result.row.DerivedStatus == "OK" {
		p.successCount++
		return
	}

	p.failureCount++
	if len(p.failureSamples) >= 10 {
		return
	}

	failureMessage := result.row.DerivedStatus
	if result.resultErr != nil {
		failureMessage = result.resultErr.Error()
	}
	p.failureSamples = append(p.failureSamples, map[string]any{
		"site_id":     result.target.ID,
		"site_name":   result.target.Name,
		"result_code": result.resultCode,
		"error":       failureMessage,
	})
}

func (p *batchProgress) applyRSSFetch(result rssFetchTargetResult) {
	p.processedCount++
	if result.resultErr == nil {
		p.successCount++
		return
	}

	p.failureCount++
	if len(p.failureSamples) >= 10 {
		return
	}

	p.failureSamples = append(p.failureSamples, map[string]any{
		"site_id":   result.target.ID,
		"site_name": result.target.Name,
		"feed_url":  result.row.FeedURL,
		"error":     result.resultErr.Error(),
	})
}

func (p *batchProgress) runningResult() map[string]any {
	return map[string]any{
		"processed_count": p.processedCount,
		"success_count":   p.successCount,
		"failure_count":   p.failureCount,
		"total_count":     p.totalCount,
		"failure_samples": p.failureSamples,
	}
}

func (p *batchProgress) output(task string) map[string]any {
	result := p.runningResult()
	result["task"] = task
	return result
}

func (s *Service) logSiteCheckTargetCompleted(
	ctx context.Context,
	runtime Runtime,
	result siteCheckTargetResult,
	progress *batchProgress,
) {
	payload := map[string]any{
		"site_id":                result.target.ID,
		"site_name":              result.target.Name,
		"batch_slot":             result.batchSlot,
		"processed_count":        progress.processedCount,
		"total_count":            progress.totalCount,
		"success_count":          progress.successCount,
		"failure_count":          progress.failureCount,
		"progress":               fmt.Sprintf("%d/%d", progress.processedCount, progress.totalCount),
		"duration_ms":            completedDurationMS(result.row.StartedTime, result.row.FinishedTime),
		"run_status":             result.row.Status,
		"result_code":            result.resultCode,
		"effective_access_scope": result.row.EffectiveAccessScope,
		"derived_access_scope":   result.row.DerivedAccessScope,
		"derived_status":         result.row.DerivedStatus,
	}
	if result.resultErr != nil {
		payload["error"] = result.resultErr.Error()
	}
	runtime.Log(ctx, "INFO", "site_check.target_completed", "site check target completed", payload)
}

func (s *Service) logRSSFetchTargetCompleted(
	ctx context.Context,
	runtime Runtime,
	result rssFetchTargetResult,
	progress *batchProgress,
) {
	payload := map[string]any{
		"site_id":                result.target.ID,
		"site_name":              result.target.Name,
		"batch_slot":             result.batchSlot,
		"processed_count":        progress.processedCount,
		"total_count":            progress.totalCount,
		"success_count":          progress.successCount,
		"failure_count":          progress.failureCount,
		"progress":               fmt.Sprintf("%d/%d", progress.processedCount, progress.totalCount),
		"duration_ms":            completedDurationMS(result.row.StartedTime, result.row.FinishedTime),
		"run_status":             result.row.Status,
		"feed_url":               result.row.FeedURL,
		"effective_access_scope": result.row.EffectiveAccessScope,
		"network_path":           result.row.NetworkPath,
		"fallback_used":          result.row.FallbackUsed,
		"article_count":          result.row.ArticleCount,
		"upserted_count":         result.row.UpsertedCount,
		"skipped_count":          result.row.SkippedCount,
	}
	if result.resultErr != nil {
		payload["error"] = result.resultErr.Error()
	}
	runtime.Log(ctx, "INFO", "rss_fetch.target_completed", "rss fetch target completed", payload)
}

func completedDurationMS(startedAt time.Time, finishedAt *time.Time) int {
	if finishedAt == nil {
		return 0
	}

	return int(finishedAt.Sub(startedAt).Milliseconds())
}
