package feedparser_test

import (
	"testing"

	"zhblogs.net/src/feedparser"
)

func TestParsePublishedTimePreservesExplicitTimezone(t *testing.T) {
	parsed := feedparser.ParsePublishedTime("2026-04-16T08:30:00+02:00")
	if parsed == nil {
		t.Fatalf("expected parsed time")
	}

	if got := parsed.Format("2006-01-02T15:04:05Z07:00"); got != "2026-04-16T06:30:00Z" {
		t.Fatalf("expected explicit timezone to be preserved, got %s", got)
	}
}

func TestParsePublishedTimeDefaultsToChinaTimezone(t *testing.T) {
	parsed := feedparser.ParsePublishedTime("2026-04-16 08:30:00")
	if parsed == nil {
		t.Fatalf("expected parsed time")
	}

	if got := parsed.Format("2006-01-02T15:04:05Z07:00"); got != "2026-04-16T00:30:00Z" {
		t.Fatalf("expected Asia/Shanghai fallback, got %s", got)
	}
}

func TestParsePublishedTimeFallsBackWhenTimezoneTokenIsUnknown(t *testing.T) {
	parsed := feedparser.ParsePublishedTime("2026-04-16 08:30:00 FOO")
	if parsed == nil {
		t.Fatalf("expected parsed time")
	}

	if got := parsed.Format("2006-01-02T15:04:05Z07:00"); got != "2026-04-16T00:30:00Z" {
		t.Fatalf("expected unknown timezone token to fallback to UTC+8, got %s", got)
	}
}
