package handlers

import (
	"context"
	"strings"
	"time"

	"zhblogs.net/src/store"
)

func (s *Service) runRSSFetchForTarget(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
	target *store.SiteTarget,
	startedAt time.Time,
) (store.RSSFetchRunRow, error) {
	requestConfig, err := s.resolveRequestConfig(ctx, job, payload, "", "RSS_FETCH")
	if err != nil {
		return failedRSSFetchRun(job, target, payload, startedAt, "REQUEST_CONFIG_ERROR", err), err
	}

	recentScopes, err := s.store.LoadRecentDerivedAccessScopes(ctx, target.ID)
	if err != nil {
		return failedRSSFetchRun(job, target, payload, startedAt, "RSS_SCOPE_ERROR", err), err
	}

	networkPath := resolveRSSNetworkPath(recentScopes)
	effectiveAccessScope := effectiveAccessScopeForRSS(networkPath)
	feedURLs := resolveFeedURLs(target.Feed, payload.Options)
	if len(feedURLs) == 0 {
		return skippedRSSFetchRun(job, target, requestConfig.ID, startedAt, payload.Options, effectiveAccessScope, networkPath), nil
	}

	return s.fetchRSSArticles(
		ctx,
		runtime,
		job,
		target,
		payload.Options,
		requestConfig,
		startedAt,
		effectiveAccessScope,
		networkPath,
		feedURLs,
	)
}

func failedRSSFetchRun(
	job store.JobRecord,
	target *store.SiteTarget,
	payload JobPayload,
	startedAt time.Time,
	errorCode string,
	err error,
) store.RSSFetchRunRow {
	return store.RSSFetchRunRow{
		JobID:           job.ID,
		SiteID:          target.ID,
		RequestConfigID: chooseFirstNonEmpty(payload.RequestConfigID, job.RequestConfigID),
		Status:          "FAILED",
		FeedFormat:      "UNKNOWN",
		ErrorCode:       errorCode,
		ErrorMessage:    err.Error(),
		StartedTime:     startedAt,
	}
}

func skippedRSSFetchRun(
	job store.JobRecord,
	target *store.SiteTarget,
	requestConfigID string,
	startedAt time.Time,
	options JobOptions,
	effectiveAccessScope string,
	networkPath string,
) store.RSSFetchRunRow {
	return store.RSSFetchRunRow{
		JobID:                job.ID,
		SiteID:               target.ID,
		RequestConfigID:      requestConfigID,
		Status:               "SKIPPED",
		FeedFormat:           "UNKNOWN",
		EffectiveAccessScope: effectiveAccessScope,
		NetworkPath:          networkPath,
		SkippedCount:         1,
		SummaryPayload: map[string]any{
			"site_id":        target.ID,
			"site_name":      target.Name,
			"feed_mode":      chooseFirstNonEmpty(options.FeedMode, "DEFAULT_ONLY"),
			"network_path":   networkPath,
			"skipped_reason": "NO_FEED_URL",
		},
		StartedTime: startedAt,
	}
}

func (s *Service) fetchRSSArticles(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	target *store.SiteTarget,
	options JobOptions,
	requestConfig *store.RequestConfigRecord,
	startedAt time.Time,
	effectiveAccessScope string,
	networkPath string,
	feedURLs []string,
) (store.RSSFetchRunRow, error) {
	articleCount := 0
	upsertedCount := 0
	skippedCount := 0
	feedFormat := "UNKNOWN"
	sourceKind := ""
	fallbackUsed := false

	for _, feedURL := range feedURLs {
		articles, source, usedFallback, fetchErr := s.fetchArticles(
			ctx,
			runtime,
			target,
			feedURL,
			requestConfig,
			networkPath,
		)
		sourceKind = normalizeRSSSourceKind(source)
		fallbackUsed = fallbackUsed || usedFallback
		if fetchErr != nil {
			return buildFailedRSSFetchRun(
				job,
				target,
				requestConfig.ID,
				startedAt,
				feedURL,
				feedFormat,
				sourceKind,
				effectiveAccessScope,
				networkPath,
				fallbackUsed,
				fetchErr,
			), fetchErr
		}

		feedFormat = updateFeedFormat(feedFormat, articles)
		articleCount += len(articles)
		upsertedCount, skippedCount = s.persistFeedArticles(ctx, target.ID, articles, upsertedCount, skippedCount)
	}

	return store.RSSFetchRunRow{
		JobID:                job.ID,
		SiteID:               target.ID,
		RequestConfigID:      requestConfig.ID,
		Status:               "SUCCEEDED",
		FeedURL:              firstFeedURL(feedURLs),
		FeedFormat:           feedFormat,
		SourceKind:           sourceKind,
		EffectiveAccessScope: effectiveAccessScope,
		NetworkPath:          networkPath,
		FallbackUsed:         fallbackUsed,
		ArticleCount:         articleCount,
		UpsertedCount:        upsertedCount,
		SkippedCount:         skippedCount,
		SummaryPayload: map[string]any{
			"site_id":       target.ID,
			"site_name":     target.Name,
			"feed_mode":     chooseFirstNonEmpty(options.FeedMode, "DEFAULT_ONLY"),
			"source_kind":   sourceKind,
			"network_path":  networkPath,
			"fallback_used": fallbackUsed,
			"article_urls":  []string{},
		},
		StartedTime: startedAt,
	}, nil
}

func buildFailedRSSFetchRun(
	job store.JobRecord,
	target *store.SiteTarget,
	requestConfigID string,
	startedAt time.Time,
	feedURL string,
	feedFormat string,
	sourceKind string,
	effectiveAccessScope string,
	networkPath string,
	fallbackUsed bool,
	err error,
) store.RSSFetchRunRow {
	return store.RSSFetchRunRow{
		JobID:                job.ID,
		SiteID:               target.ID,
		RequestConfigID:      requestConfigID,
		Status:               "FAILED",
		FeedURL:              feedURL,
		FeedFormat:           feedFormat,
		SourceKind:           sourceKind,
		EffectiveAccessScope: effectiveAccessScope,
		NetworkPath:          networkPath,
		FallbackUsed:         fallbackUsed,
		ErrorCode:            mapErrorCode(err),
		ErrorMessage:         err.Error(),
		SummaryPayload: map[string]any{
			"site_id":       target.ID,
			"site_name":     target.Name,
			"feed_url":      feedURL,
			"source_kind":   sourceKind,
			"network_path":  networkPath,
			"fallback_used": fallbackUsed,
		},
		StartedTime: startedAt,
	}
}

func updateFeedFormat(current string, articles []store.FeedArticleRow) string {
	if current != "UNKNOWN" || len(articles) == 0 {
		return current
	}

	rawType, ok := articles[0].Source["feed_type"].(string)
	if !ok || strings.TrimSpace(rawType) == "" {
		return current
	}

	return strings.ToUpper(strings.TrimSpace(rawType))
}

func (s *Service) persistFeedArticles(
	ctx context.Context,
	siteID string,
	articles []store.FeedArticleRow,
	upsertedCount int,
	skippedCount int,
) (int, int) {
	for _, article := range articles {
		if article.ArticleURL == "" || article.Title == "" {
			skippedCount++
			continue
		}
		if err := s.store.UpsertFeedArticle(ctx, siteID, article); err != nil {
			skippedCount++
			continue
		}
		upsertedCount++
	}

	return upsertedCount, skippedCount
}

func optionalInt(value int) *int {
	if value <= 0 {
		return nil
	}

	result := value
	return &result
}

func chooseFirstNonEmpty(values ...string) string {
	for _, item := range values {
		if strings.TrimSpace(item) != "" {
			return strings.TrimSpace(item)
		}
	}

	return ""
}
