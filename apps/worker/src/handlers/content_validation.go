package handlers

import (
	"context"
	"net/url"
	"strings"

	"zhblogs.net/src/feedparser"
	"zhblogs.net/src/store"
)

func (s *Service) runContentValidation(
	ctx context.Context,
	target *store.SiteTarget,
	requestConfig *store.RequestConfigRecord,
	cnProbe *ProbeResult,
	globalProbe *ProbeResult,
) (string, map[string]any) {
	issues := make([]map[string]any, 0)
	proposedChanges := map[string]any{}

	homeProbe := chooseValidationProbe(cnProbe, globalProbe)
	if homeProbe != nil && !matchesExpectedTitle(target.Name, extractHTMLTitle(homeProbe.Body)) {
		issues = append(issues, map[string]any{
			"field":    "url",
			"code":     "TITLE_MISMATCH",
			"expected": target.Name,
			"actual":   extractHTMLTitle(homeProbe.Body),
		})
	}
	if homeProbe != nil && strings.TrimSpace(homeProbe.FinalURL) != "" && !sameURL(target.URL, homeProbe.FinalURL) {
		proposedChanges["url"] = strings.TrimSpace(homeProbe.FinalURL)
	}

	feedIssues, feedChanges := validateFeedConfigs(ctx, target, requestConfig)
	issues = append(issues, feedIssues...)
	for key, value := range feedChanges {
		proposedChanges[key] = value
	}

	sitemapIssues, sitemapChanges := validateLinkField(ctx, "sitemap", target.URL, target.Sitemap, requestConfig)
	issues = append(issues, sitemapIssues...)
	for key, value := range sitemapChanges {
		proposedChanges[key] = value
	}

	linkPageIssues, linkPageChanges := validateLinkField(ctx, "link_page", target.URL, target.LinkPage, requestConfig)
	issues = append(issues, linkPageIssues...)
	for key, value := range linkPageChanges {
		proposedChanges[key] = value
	}

	status := "PASSED"
	if len(issues) > 0 {
		status = "FAILED"
	}

	appliedCorrection, correctionError := s.siteCorrectionClient.Submit(ctx, target.ID, proposedChanges)
	if correctionError != "" {
		issues = append(issues, map[string]any{
			"field": "system",
			"code":  "CORRECTION_SUBMIT_FAILED",
			"error": correctionError,
		})
	}

	return status, map[string]any{
		"issues":             issues,
		"proposed_changes":   proposedChanges,
		"applied_correction": appliedCorrection,
	}
}

func chooseValidationProbe(cnProbe *ProbeResult, globalProbe *ProbeResult) *ProbeResult {
	for _, item := range []*ProbeResult{cnProbe, globalProbe} {
		if item != nil && item.Result == "SUCCESS" && len(item.Body) > 0 {
			return item
		}
	}

	return nil
}

func matchesExpectedTitle(expected string, actual string) bool {
	expectedText := normalizeText(expected)
	actualText := normalizeText(actual)
	if expectedText == "" || actualText == "" {
		return false
	}

	return expectedText == actualText || strings.Contains(actualText, expectedText)
}

func validateFeedConfigs(
	ctx context.Context,
	target *store.SiteTarget,
	requestConfig *store.RequestConfigRecord,
) ([]map[string]any, map[string]any) {
	issues := make([]map[string]any, 0)
	if len(target.Feed) == 0 {
		return issues, map[string]any{}
	}

	updatedFeed := cloneFeedConfigs(target.Feed)
	siteHost := extractHost(target.URL)
	for index, item := range updatedFeed {
		issue, finalURL, actualType := validateSingleFeed(ctx, siteHost, item, requestConfig)
		if issue != nil {
			issues = append(issues, issue)
			continue
		}
		if finalURL != "" && !sameURL(item.URL, finalURL) {
			updatedFeed[index].URL = finalURL
		}
		if actualType != "" && item.Type != "" && strings.ToUpper(item.Type) != actualType {
			issues = append(issues, map[string]any{
				"field":    "feed",
				"code":     "FEED_TYPE_MISMATCH",
				"expected": strings.ToUpper(item.Type),
				"actual":   actualType,
				"url":      item.URL,
			})
		}
	}

	if len(issues) > 0 || !sameFeedConfigs(target.Feed, updatedFeed) {
		return issues, map[string]any{"feed": updatedFeed}
	}

	return issues, map[string]any{}
}

func validateSingleFeed(
	ctx context.Context,
	siteHost string,
	item store.SiteFeedConfig,
	requestConfig *store.RequestConfigRecord,
) (map[string]any, string, string) {
	result, err := fetchURL(ctx, item.URL, requestConfig)
	if err != nil {
		return map[string]any{"field": "feed", "code": "FEED_FETCH_FAILED", "url": item.URL, "error": err.Error()}, "", ""
	}
	if result.StatusCode >= 400 {
		return map[string]any{"field": "feed", "code": "FEED_HTTP_ERROR", "url": item.URL, "status_code": result.StatusCode}, "", ""
	}

	articles, parseErr := feedparser.ParseContent(result.Body, result.FinalURL)
	if parseErr != nil || len(articles) == 0 {
		return map[string]any{"field": "feed", "code": "FEED_PARSE_FAILED", "url": item.URL}, "", ""
	}
	if !hasMatchingArticleHost(siteHost, articles) {
		return map[string]any{"field": "feed", "code": "FEED_HOST_MISMATCH", "url": item.URL}, result.FinalURL, strings.ToUpper(articles[0].FeedType)
	}

	return nil, result.FinalURL, strings.ToUpper(articles[0].FeedType)
}

func validateLinkField(
	ctx context.Context,
	field string,
	siteURL string,
	targetURL string,
	requestConfig *store.RequestConfigRecord,
) ([]map[string]any, map[string]any) {
	trimmed := strings.TrimSpace(targetURL)
	if trimmed == "" {
		return nil, map[string]any{}
	}

	result, err := fetchURL(ctx, trimmed, requestConfig)
	if err != nil {
		return []map[string]any{{"field": field, "code": "FETCH_FAILED", "url": trimmed, "error": err.Error()}}, map[string]any{}
	}
	if result.StatusCode >= 400 {
		return []map[string]any{{"field": field, "code": "HTTP_ERROR", "url": trimmed, "status_code": result.StatusCode}}, map[string]any{}
	}
	if !bodyContainsHost(result.Body, extractHost(siteURL)) {
		return []map[string]any{{"field": field, "code": "HOST_MISMATCH", "url": trimmed}}, map[string]any{}
	}
	if !sameURL(trimmed, result.FinalURL) {
		return nil, map[string]any{field: result.FinalURL}
	}

	return nil, map[string]any{}
}

func hasMatchingArticleHost(siteHost string, articles []store.FeedArticleRow) bool {
	for _, item := range articles {
		if extractHost(item.ArticleURL) == siteHost {
			return true
		}
	}

	return false
}

func bodyContainsHost(body []byte, host string) bool {
	if host == "" {
		return false
	}

	return strings.Contains(strings.ToLower(string(body)), strings.ToLower(host))
}

func extractHost(rawURL string) string {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return ""
	}

	return strings.ToLower(parsed.Host)
}

func sameURL(left string, right string) bool {
	return normalizeText(left) == normalizeText(right)
}

func normalizeText(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func cloneFeedConfigs(feed []store.SiteFeedConfig) []store.SiteFeedConfig {
	result := make([]store.SiteFeedConfig, len(feed))
	copy(result, feed)
	return result
}

func sameFeedConfigs(left []store.SiteFeedConfig, right []store.SiteFeedConfig) bool {
	if len(left) != len(right) {
		return false
	}

	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}

	return true
}
