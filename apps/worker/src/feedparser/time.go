package feedparser

import (
	"regexp"
	"strings"
	"time"
)

var (
	defaultFeedTimezone       = time.FixedZone("UTC+8", 8*60*60)
	namedTimezoneExpr         = regexp.MustCompile(`\s+([A-Z]{2,5})$`)
	trailingTimezoneTokenExpr = regexp.MustCompile(`\s+(?:[A-Z]{2,5}|(?:UTC|GMT)[+-]\d{1,2}(?::?\d{2})?)$`)
)

func ParsePublishedTime(raw string) *time.Time {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil
	}

	if parsed := parsePublishedTimeWithLayouts(value, publishedTimeZoneLayouts, time.Parse); parsed != nil {
		return parsed
	}

	if parsed := parsePublishedTimeWithNamedTimezone(value); parsed != nil {
		return parsed
	}

	normalized := trailingTimezoneTokenExpr.ReplaceAllString(value, "")
	return parsePublishedTimeWithLayouts(
		normalized,
		publishedTimeLocalLayouts,
		func(layout string, input string) (time.Time, error) {
			return time.ParseInLocation(layout, input, defaultFeedTimezone)
		},
	)
}

func parsePublishedTimeWithLayouts(
	value string,
	layouts []string,
	parse func(string, string) (time.Time, error),
) *time.Time {
	for _, layout := range layouts {
		parsed, err := parse(layout, value)
		if err == nil {
			result := parsed.UTC()
			return &result
		}
	}

	return nil
}

func parsePublishedTimeWithNamedTimezone(value string) *time.Time {
	matches := namedTimezoneExpr.FindStringSubmatch(value)
	if len(matches) != 2 {
		return nil
	}

	offset, ok := namedTimezoneOffsets[matches[1]]
	if !ok {
		return nil
	}

	trimmed := strings.TrimSpace(strings.TrimSuffix(value, matches[1]))
	location := time.FixedZone(matches[1], offset)
	return parsePublishedTimeWithLayouts(
		trimmed,
		publishedTimeLocalLayouts,
		func(layout string, input string) (time.Time, error) {
			return time.ParseInLocation(layout, input, location)
		},
	)
}

var publishedTimeZoneLayouts = []string{
	time.RFC3339,
	time.RFC3339Nano,
	time.RFC1123Z,
	time.RFC822Z,
	"2006-01-02T15:04:05-0700",
	"2006-01-02 15:04:05 -0700",
	"2006-01-02T15:04-0700",
	"2006-01-02 15:04 -0700",
}

var publishedTimeLocalLayouts = []string{
	"2006-01-02T15:04:05",
	"2006-01-02 15:04:05",
	"2006-01-02T15:04",
	"2006-01-02 15:04",
	"2006-01-02",
	"Mon, 02 Jan 2006 15:04:05",
	"Mon, 02 Jan 2006 15:04",
}

var namedTimezoneOffsets = map[string]int{
	"UTC":  0,
	"GMT":  0,
	"UT":   0,
	"CST":  8 * 60 * 60,
	"HKT":  8 * 60 * 60,
	"SGT":  8 * 60 * 60,
	"JST":  9 * 60 * 60,
	"KST":  9 * 60 * 60,
	"PST":  -8 * 60 * 60,
	"PDT":  -7 * 60 * 60,
	"MST":  -7 * 60 * 60,
	"MDT":  -6 * 60 * 60,
	"CET":  1 * 60 * 60,
	"CEST": 2 * 60 * 60,
	"EST":  -5 * 60 * 60,
	"EDT":  -4 * 60 * 60,
}
