package feedparser

import (
	"html"
	"regexp"
	"strings"
)

var (
	feedAnchorTagExpr      = regexp.MustCompile(`(?is)<a\b[^>]*>.*?</a>`)
	feedScriptStyleTagExpr = regexp.MustCompile(`(?is)<(?:script|style)\b[^>]*>.*?</(?:script|style)>`)
	feedHtmlCommentExpr    = regexp.MustCompile(`(?is)<!--.*?-->`)
	feedHtmlTagExpr        = regexp.MustCompile(`(?is)<[^>]+>`)
)

func SanitizeText(value string, removeLinkContent bool) string {
	cleaned := strings.TrimSpace(value)
	if cleaned == "" {
		return ""
	}

	if removeLinkContent {
		cleaned = feedAnchorTagExpr.ReplaceAllString(cleaned, " ")
	}

	cleaned = feedScriptStyleTagExpr.ReplaceAllString(cleaned, " ")
	cleaned = feedHtmlCommentExpr.ReplaceAllString(cleaned, " ")
	cleaned = feedHtmlTagExpr.ReplaceAllString(cleaned, " ")
	cleaned = html.UnescapeString(cleaned)

	return strings.Join(strings.Fields(cleaned), " ")
}
