package handlers

import (
	"context"

	"zhblogs.net/src/store"
)

func (s *Service) prepareSiteCheckResume(
	ctx context.Context,
	jobID string,
	targets []store.SiteTarget,
) (*batchProgress, []store.SiteTarget, error) {
	records, err := s.store.LoadSiteCheckResumeRecords(ctx, jobID)
	if err != nil {
		return nil, nil, err
	}

	progress := newBatchProgress(len(targets))
	completed := makeCompletedLookup(records, func(record store.SiteCheckResumeRecord) string { return record.SiteID })
	targetNameByID := buildTargetNameByID(targets)
	for _, record := range records {
		progress.processedCount++
		if record.Status == "SUCCEEDED" && record.DerivedStatus == "OK" {
			progress.successCount++
			continue
		}

		progress.failureCount++
		appendFailureSample(progress, record.SiteID, targetNameByID[record.SiteID], record.ErrorMessage)
	}

	return progress, filterSiteTargets(targets, completed), nil
}

func (s *Service) prepareRSSFetchResume(
	ctx context.Context,
	jobID string,
	targets []store.SiteTarget,
) (*batchProgress, []store.SiteTarget, error) {
	records, err := s.store.LoadRSSFetchResumeRecords(ctx, jobID)
	if err != nil {
		return nil, nil, err
	}

	progress := newBatchProgress(len(targets))
	completed := makeCompletedLookup(records, func(record store.RSSFetchResumeRecord) string { return record.SiteID })
	targetNameByID := buildTargetNameByID(targets)
	for _, record := range records {
		progress.processedCount++
		if record.Status != "FAILED" {
			progress.successCount++
			continue
		}

		progress.failureCount++
		appendFailureSample(progress, record.SiteID, targetNameByID[record.SiteID], record.ErrorMessage)
	}

	return progress, filterSiteTargets(targets, completed), nil
}

func buildTargetNameByID(targets []store.SiteTarget) map[string]string {
	names := make(map[string]string, len(targets))
	for _, target := range targets {
		names[target.ID] = target.Name
	}
	return names
}

func makeCompletedLookup[T any](records []T, pickID func(T) string) map[string]struct{} {
	lookup := make(map[string]struct{}, len(records))
	for _, record := range records {
		lookup[pickID(record)] = struct{}{}
	}
	return lookup
}

func filterSiteTargets(targets []store.SiteTarget, completed map[string]struct{}) []store.SiteTarget {
	filtered := make([]store.SiteTarget, 0, len(targets))
	for _, target := range targets {
		if _, exists := completed[target.ID]; exists {
			continue
		}
		filtered = append(filtered, target)
	}
	return filtered
}

func appendFailureSample(progress *batchProgress, id string, name string, message string) {
	if len(progress.failureSamples) >= 10 {
		return
	}

	progress.failureSamples = append(progress.failureSamples, map[string]any{
		"site_id":   id,
		"site_name": name,
		"error":     message,
	})
}
