package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"zhblogs.net/src/feedparser"
	"zhblogs.net/src/store"
)

func (s *Service) fetchArticles(
	ctx context.Context,
	runtime Runtime,
	target *store.SiteTarget,
	feedURL string,
	requestConfig *store.RequestConfigRecord,
	networkPath string,
) ([]store.FeedArticleRow, string, bool, error) {
	if networkPath == "NON_CN_ONLY" {
		articles, err := s.fetchCloudflareArticles(ctx, runtime, feedURL)
		return articles, "cloudflare", false, err
	}

	articles, err := fetchAndParseFeed(ctx, feedURL, requestConfig)
	if err == nil || networkPath == "CN_ONLY" {
		return articles, "local", false, err
	}

	if s.cloudflare == nil {
		return nil, "local", false, err
	}

	articles, fallbackErr := s.fetchCloudflareArticles(ctx, runtime, feedURL)
	if fallbackErr != nil {
		return nil, "cloudflare-fallback", true, fallbackErr
	}

	return articles, "cloudflare-fallback", true, nil
}

func (s *Service) fetchCloudflareArticles(
	ctx context.Context,
	runtime Runtime,
	feedURL string,
) ([]store.FeedArticleRow, error) {
	response, err := s.cloudflare.FetchRSS(ctx, feedURL)
	if err != nil {
		return nil, err
	}

	if !response.OK || response.Data.Content == "" {
		return nil, fmt.Errorf("cloudflare rss fetch returned empty content")
	}

	return feedparser.ParseContent([]byte(response.Data.Content), response.Data.FinalURL)
}

func fetchAndParseFeed(
	ctx context.Context,
	feedURL string,
	requestConfig *store.RequestConfigRecord,
) ([]store.FeedArticleRow, error) {
	response, err := fetchURL(ctx, feedURL, requestConfig)
	if err != nil {
		return nil, fmt.Errorf("fetch feed: %w", err)
	}

	if response.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("feed status=%d", response.StatusCode)
	}

	return feedparser.ParseContent(response.Body, response.FinalURL)
}

func resolveDefaultFeedURL(feed []store.SiteFeedConfig) string {
	for _, item := range feed {
		if item.IsDefault && strings.TrimSpace(item.URL) != "" {
			return strings.TrimSpace(item.URL)
		}
	}

	for _, item := range feed {
		if strings.TrimSpace(item.URL) != "" {
			return strings.TrimSpace(item.URL)
		}
	}

	return ""
}

func resolveFeedURLs(feed []store.SiteFeedConfig, options JobOptions) []string {
	if len(options.FeedURLs) > 0 {
		result := make([]string, 0, len(options.FeedURLs))
		for _, item := range options.FeedURLs {
			if strings.TrimSpace(item) != "" {
				result = append(result, strings.TrimSpace(item))
			}
		}
		return result
	}

	if strings.EqualFold(options.FeedMode, "ALL") {
		result := make([]string, 0, len(feed))
		for _, item := range feed {
			if strings.TrimSpace(item.URL) != "" {
				result = append(result, strings.TrimSpace(item.URL))
			}
		}
		return result
	}

	defaultFeedURL := resolveDefaultFeedURL(feed)
	if defaultFeedURL == "" {
		return nil
	}

	return []string{defaultFeedURL}
}

func firstFeedURL(feedURLs []string) string {
	if len(feedURLs) == 0 {
		return ""
	}
	return strings.TrimSpace(feedURLs[0])
}

func normalizeRSSSourceKind(source string) string {
	switch strings.TrimSpace(source) {
	case "cloudflare":
		return "CLOUDFLARE"
	case "cloudflare-fallback":
		return "CLOUDFLARE_FALLBACK"
	default:
		return "LOCAL"
	}
}
