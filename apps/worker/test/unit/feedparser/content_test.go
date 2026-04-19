package feedparser_test

import (
	"testing"

	"zhblogs.net/src/feedparser"
)

func TestParseFeedContentUsesGofeedAndSanitizesSummary(t *testing.T) {
	articles, err := feedparser.ParseContent([]byte(`
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Sample Feed</title>
    <item>
      <title><![CDATA[Hello <em>World</em>]]></title>
      <link>https://alpha.example/posts/1</link>
      <guid>post-1</guid>
      <description><![CDATA[<p>Before <a href="https://bad.example">remove me</a> after</p>]]></description>
      <pubDate>2026-04-16 08:30:00</pubDate>
    </item>
  </channel>
</rss>
`), "https://alpha.example/feed.xml")
	if err != nil {
		t.Fatalf("parse feed content: %v", err)
	}

	if len(articles) != 1 {
		t.Fatalf("expected 1 article, got %d", len(articles))
	}

	article := articles[0]
	if article.Title != "Hello World" {
		t.Fatalf("expected sanitized title, got %q", article.Title)
	}
	if article.Summary != "Before after" {
		t.Fatalf("expected sanitized summary, got %q", article.Summary)
	}
	if article.FeedType != "RSS" {
		t.Fatalf("expected RSS feed type, got %q", article.FeedType)
	}
	if article.Source["feed_name"] != "Sample Feed" {
		t.Fatalf("expected feed name, got %#v", article.Source["feed_name"])
	}
	if article.Published == nil {
		t.Fatalf("expected published time")
	}
	if got := article.Published.Format("2006-01-02T15:04:05Z07:00"); got != "2026-04-16T00:30:00Z" {
		t.Fatalf("expected UTC+8 fallback storage, got %s", got)
	}
}

func TestSanitizeFeedTextDropsAnchorContent(t *testing.T) {
	value := feedparser.SanitizeText(`<div>foo <a href="https://alpha.example">bar</a> baz</div>`, true)
	if value != "foo baz" {
		t.Fatalf("expected anchor content removed, got %q", value)
	}
}
