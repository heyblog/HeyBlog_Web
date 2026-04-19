package feedparser

import (
	"bytes"
	"strings"
	"time"

	"github.com/mmcdole/gofeed"

	"zhblogs.net/src/store"
)

func ParseContent(body []byte, feedURL string) ([]store.FeedArticleRow, error) {
	parser := gofeed.NewParser()
	feed, err := parser.Parse(bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	return mapParsedFeed(feed, feedURL), nil
}

func mapParsedFeed(feed *gofeed.Feed, feedURL string) []store.FeedArticleRow {
	if feed == nil || len(feed.Items) == 0 {
		return nil
	}

	feedType := normalizeFeedType(feed.FeedType)
	feedName := strings.TrimSpace(feed.Title)
	result := make([]store.FeedArticleRow, 0, len(feed.Items))

	for _, item := range feed.Items {
		row, ok := createFeedArticleRow(item, feedURL, feedName, feedType)
		if ok {
			result = append(result, row)
		}
	}

	return result
}

func createFeedArticleRow(
	item *gofeed.Item,
	feedURL string,
	feedName string,
	feedType string,
) (store.FeedArticleRow, bool) {
	link := resolveFeedArticleURL(item)
	title := SanitizeText(item.Title, true)
	if link == "" || title == "" {
		return store.FeedArticleRow{}, false
	}

	return store.FeedArticleRow{
		GUID:       resolveFeedArticleGUID(item, link),
		ArticleURL: link,
		Title:      title,
		Summary:    resolveFeedArticleSummary(item),
		FeedType:   feedType,
		Source:     buildFeedArticleSource(feedURL, feedName, feedType),
		Published:  resolveFeedArticlePublished(item),
	}, true
}

func buildFeedArticleSource(feedURL string, feedName string, feedType string) map[string]any {
	return map[string]any{
		"feed_type": feedType,
		"feed_url":  feedURL,
		"feed_name": emptyStringToNil(feedName),
	}
}

func resolveFeedArticleGUID(item *gofeed.Item, fallback string) string {
	if item == nil {
		return fallback
	}

	if guid := strings.TrimSpace(item.GUID); guid != "" {
		return guid
	}

	return fallback
}

func resolveFeedArticleURL(item *gofeed.Item) string {
	if item == nil {
		return ""
	}

	if link := strings.TrimSpace(item.Link); link != "" {
		return link
	}

	guid := strings.TrimSpace(item.GUID)
	if strings.HasPrefix(guid, "http://") || strings.HasPrefix(guid, "https://") {
		return guid
	}

	return ""
}

func resolveFeedArticleSummary(item *gofeed.Item) string {
	if item == nil {
		return ""
	}

	summary := SanitizeText(item.Description, true)
	if summary != "" {
		return summary
	}

	return SanitizeText(item.Content, true)
}

func resolveFeedArticlePublished(item *gofeed.Item) *time.Time {
	if item == nil {
		return nil
	}

	for _, raw := range []string{item.Published, item.Updated} {
		if parsed := ParsePublishedTime(raw); parsed != nil {
			return parsed
		}
	}

	for _, parsed := range []*time.Time{item.PublishedParsed, item.UpdatedParsed} {
		if parsed != nil {
			result := parsed.UTC()
			return &result
		}
	}

	return nil
}

func normalizeFeedType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "rss":
		return "RSS"
	case "atom":
		return "ATOM"
	case "json":
		return "JSON"
	default:
		return "UNKNOWN"
	}
}

func emptyStringToNil(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}

	return strings.TrimSpace(value)
}
