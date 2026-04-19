package handlers

import (
	"context"
	"errors"
	"fmt"
	"net"
	"regexp"
	"strings"
	"time"

	"zhblogs.net/src/store"
)

func (s *Service) runSiteCheckForTarget(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
	target *store.SiteTarget,
	startedAt time.Time,
) (store.SiteCheckRunRow, string, error) {
	requestConfig, err := s.resolveRequestConfig(ctx, job, payload, "", "SITE_CHECK")
	if err != nil {
		return failedSiteCheckRun(job, target, payload, startedAt, err), "REQUEST_CONFIG_ERROR", err
	}

	effectiveAccessScope, checkMode, err := s.resolveSiteCheckScope(ctx, target.ID, payload.Options.RunGlobalCheck)
	if err != nil {
		return failedSiteCheckRun(job, target, payload, startedAt, err), "SITE_SCOPE_ERROR", err
	}

	cnProbe, globalProbe := s.runRegionalChecks(ctx, runtime, target, requestConfig, effectiveAccessScope)
	derivedAccessScope, derivedStatus := mergeRegionalOutcome(
		effectiveAccessScope,
		rawResultToOutcome(readProbeResult(cnProbe)),
		rawResultToOutcome(readProbeResult(globalProbe)),
	)

	contentValidationStatus := "NOT_REQUESTED"
	contentValidationPayload := map[string]any{}
	if derivedStatus == "OK" && payload.Options.RunContentValidation {
		contentValidationStatus, contentValidationPayload = s.runContentValidation(
			ctx,
			target,
			requestConfig,
			cnProbe,
			globalProbe,
		)
	}

	if err = s.store.UpdateSiteDerivedState(ctx, target.ID, derivedAccessScope, derivedStatus); err != nil {
		return failedSiteCheckRun(job, target, payload, startedAt, err), "SITE_UPDATE_ERROR", err
	}

	row := store.SiteCheckRunRow{
		JobID:                    job.ID,
		SiteID:                   target.ID,
		RequestConfigID:          requestConfig.ID,
		Status:                   "SUCCEEDED",
		AvailabilityResult:       summarizeAvailabilityResult(cnProbe, globalProbe),
		VerifyResult:             mapContentValidationStatus(contentValidationStatus),
		EffectiveAccessScope:     effectiveAccessScope,
		DerivedAccessScope:       derivedAccessScope,
		DerivedStatus:            derivedStatus,
		CheckMode:                checkMode,
		ContentValidationStatus:  contentValidationStatus,
		ContentValidationPayload: contentValidationPayload,
		ProbeSummary:             buildProbeSummary(cnProbe, globalProbe),
		ResponseTimeMS:           summarizeProbeMetric(cnProbe, globalProbe, func(item *ProbeResult) int { return item.ResponseTimeMS }),
		DurationMS:               summarizeProbeMetric(cnProbe, globalProbe, func(item *ProbeResult) int { return item.DurationMS }),
		JitterMS:                 nil,
		FinalURL:                 firstNonEmptyProbeURL(cnProbe, globalProbe),
		StartedTime:              startedAt,
	}

	return row, derivedStatus, nil
}

func failedSiteCheckRun(
	job store.JobRecord,
	target *store.SiteTarget,
	payload JobPayload,
	startedAt time.Time,
	err error,
) store.SiteCheckRunRow {
	return store.SiteCheckRunRow{
		JobID:                   job.ID,
		SiteID:                  target.ID,
		RequestConfigID:         chooseFirstNonEmpty(payload.RequestConfigID, job.RequestConfigID),
		Status:                  "FAILED",
		AvailabilityResult:      "FAILURE",
		VerifyResult:            "FAILED",
		EffectiveAccessScope:    "ALL",
		DerivedAccessScope:      "",
		DerivedStatus:           "",
		CheckMode:               "STANDARD",
		ContentValidationStatus: "NOT_REQUESTED",
		ProbeSummary:            []map[string]any{},
		ErrorCode:               mapErrorCode(err),
		ErrorMessage:            err.Error(),
		StartedTime:             startedAt,
	}
}

func (s *Service) resolveSiteCheckScope(
	ctx context.Context,
	siteID string,
	runGlobalCheck bool,
) (string, string, error) {
	scopes, err := s.store.LoadRecentDerivedAccessScopes(ctx, siteID)
	if err != nil {
		return "", "", err
	}

	if runGlobalCheck {
		return "ALL", "GLOBAL_FORCED", nil
	}

	return resolveEffectiveAccessScope(scopes, false), "STANDARD", nil
}

func (s *Service) runRegionalChecks(
	ctx context.Context,
	runtime Runtime,
	target *store.SiteTarget,
	requestConfig *store.RequestConfigRecord,
	effectiveAccessScope string,
) (*ProbeResult, *ProbeResult) {
	var cnProbe *ProbeResult
	var globalProbe *ProbeResult

	if shouldRunCNCheck(effectiveAccessScope) {
		cnProbe = s.runLocalSiteCheck(ctx, runtime, target, requestConfig)
	}

	if shouldRunGlobalCheck(effectiveAccessScope) {
		globalProbe = s.runGlobalSiteCheck(ctx, runtime, target)
	}

	return cnProbe, globalProbe
}

func (s *Service) runLocalSiteCheck(
	ctx context.Context,
	runtime Runtime,
	target *store.SiteTarget,
	requestConfig *store.RequestConfigRecord,
) *ProbeResult {
	result, err := fetchURL(ctx, target.URL, requestConfig)
	if err != nil {
		runtime.Log(ctx, "WARN", "site_check.cn_failed", "cn site check failed", map[string]any{
			"url":   target.URL,
			"error": err.Error(),
		})
		return &ProbeResult{Result: mapErrorCode(err), Message: err.Error()}
	}

	return buildProbeResult(result)
}

func (s *Service) runGlobalSiteCheck(
	ctx context.Context,
	runtime Runtime,
	target *store.SiteTarget,
) *ProbeResult {
	if s.cloudflare == nil {
		runtime.Log(ctx, "INFO", "site_check.global_skipped", "skip cloudflare site check", map[string]any{
			"url": target.URL,
		})
		return &ProbeResult{Result: "FAILURE", Message: "cloudflare client is disabled"}
	}

	result, err := s.cloudflare.Check(ctx, target.URL)
	if err != nil {
		return &ProbeResult{Result: mapErrorCode(err), Message: err.Error()}
	}

	return &ProbeResult{
		Result:         result.Data.Result,
		StatusCode:     result.Data.StatusCode,
		ResponseTimeMS: result.Data.ResponseTimeMS,
		DurationMS:     result.Data.DurationMS,
		FinalURL:       result.Data.FinalURL,
		ContentVerify:  result.Data.ContentVerify,
		Message:        result.Data.Message,
	}
}

func buildProbeResult(result *HTTPFetchResult) *ProbeResult {
	probe := &ProbeResult{
		Result:         "SUCCESS",
		StatusCode:     result.StatusCode,
		ResponseTimeMS: result.ResponseTimeMS,
		DurationMS:     result.DurationMS,
		FinalURL:       result.FinalURL,
		ContentVerify:  verifySiteContent(result.Body),
		Body:           result.Body,
	}

	if result.StatusCode >= 400 {
		probe.Result = "HTTP_ERROR"
		probe.Message = fmt.Sprintf("status=%d", result.StatusCode)
	}

	return probe
}

func verifySiteContent(body []byte) bool {
	content := strings.ToLower(string(body))
	return strings.Contains(content, "<html") ||
		strings.Contains(content, "<rss") ||
		strings.Contains(content, "<feed")
}

func extractHTMLTitle(body []byte) string {
	re := regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)
	matches := re.FindSubmatch(body)
	if len(matches) < 2 {
		return ""
	}

	title := strings.TrimSpace(string(matches[1]))
	if len(title) > 255 {
		return title[:255]
	}

	return title
}

func mapErrorCode(err error) string {
	if err == nil {
		return ""
	}

	message := strings.ToLower(err.Error())
	if strings.Contains(message, "timeout") {
		return "TIMEOUT"
	}
	if strings.Contains(message, "certificate") || strings.Contains(message, "tls") {
		return "SSL_ERROR"
	}
	if strings.Contains(message, "dns") ||
		strings.Contains(message, "enotfound") ||
		strings.Contains(message, "getaddrinfo") ||
		strings.Contains(message, "gai_strerror") ||
		strings.Contains(message, "service not known") ||
		strings.Contains(message, "no such host") ||
		strings.Contains(message, "resolve") {
		return "DNS_ERROR"
	}
	if strings.Contains(message, "status=") {
		return "HTTP_ERROR"
	}

	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return "TIMEOUT"
	}

	return "FAILURE"
}

func buildProbeSummary(cnProbe *ProbeResult, globalProbe *ProbeResult) []map[string]any {
	result := make([]map[string]any, 0, 2)
	if cnProbe != nil {
		result = append(result, buildProbeSummaryItem("CN", cnProbe))
	}
	if globalProbe != nil {
		result = append(result, buildProbeSummaryItem("GLOBAL", globalProbe))
	}

	return result
}

func buildProbeSummaryItem(region string, probe *ProbeResult) map[string]any {
	outcome := rawResultToOutcome(probe.Result)
	return map[string]any{
		"region":           region,
		"result":           probe.Result,
		"summary_level":    outcome.Status,
		"warning_reason":   outcome.WarningReason,
		"raw_result":       probe.Result,
		"status_code":      probe.StatusCode,
		"response_time_ms": probe.ResponseTimeMS,
		"duration_ms":      probe.DurationMS,
		"final_url":        probe.FinalURL,
		"content_verified": probe.ContentVerify,
		"page_title":       extractHTMLTitle(probe.Body),
		"message":          probe.Message,
	}
}

func summarizeAvailabilityResult(cnProbe *ProbeResult, globalProbe *ProbeResult) string {
	for _, item := range []*ProbeResult{cnProbe, globalProbe} {
		if item != nil && strings.TrimSpace(item.Result) == "SUCCESS" {
			return "SUCCESS"
		}
	}

	for _, item := range []*ProbeResult{cnProbe, globalProbe} {
		if item != nil && strings.TrimSpace(item.Result) != "" {
			return strings.TrimSpace(item.Result)
		}
	}

	return "FAILURE"
}

func mapContentValidationStatus(status string) string {
	switch status {
	case "PASSED":
		return "PASSED"
	case "FAILED":
		return "FAILED"
	default:
		return "NOT_REQUESTED"
	}
}

func readProbeResult(probe *ProbeResult) string {
	if probe == nil {
		return ""
	}

	return probe.Result
}

func firstNonEmptyProbeURL(results ...*ProbeResult) string {
	for _, item := range results {
		if item != nil && strings.TrimSpace(item.FinalURL) != "" {
			return strings.TrimSpace(item.FinalURL)
		}
	}

	return ""
}

func summarizeProbeMetric(cnProbe *ProbeResult, globalProbe *ProbeResult, read func(*ProbeResult) int) *int {
	for _, item := range []*ProbeResult{cnProbe, globalProbe} {
		if item != nil && read(item) > 0 {
			return optionalInt(read(item))
		}
	}

	return nil
}
