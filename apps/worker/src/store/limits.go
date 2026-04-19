package store

const truncatedSuffix = "... [truncated]"

func limitVarchar(value string, limit int) string {
	if limit <= 0 || value == "" {
		return ""
	}

	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}

	suffix := []rune(truncatedSuffix)
	if limit <= len(suffix) {
		return string(runes[:limit])
	}

	return string(runes[:limit-len(suffix)]) + truncatedSuffix
}
