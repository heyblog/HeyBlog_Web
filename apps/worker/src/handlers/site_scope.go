package handlers

import "strings"

type RegionalOutcome struct {
	Status        string
	RawResult     string
	WarningReason string
}

func resolveEffectiveAccessScope(scopes []string, forceAll bool) string {
	if forceAll || len(scopes) != 3 {
		return "ALL"
	}

	first := strings.TrimSpace(scopes[0])
	if first == "" {
		return "ALL"
	}

	for _, item := range scopes[1:] {
		if strings.TrimSpace(item) != first {
			return "ALL"
		}
	}

	return first
}

func resolveRSSNetworkPath(scopes []string) string {
	if len(scopes) == 3 && allScopesMatch(scopes, "CN_ONLY") {
		return "CN_ONLY"
	}

	if len(scopes) == 3 && allScopesMatch(scopes, "NON_CN_ONLY") {
		return "NON_CN_ONLY"
	}

	return "CN_THEN_NON_CN"
}

func effectiveAccessScopeForRSS(networkPath string) string {
	switch networkPath {
	case "CN_ONLY":
		return "CN_ONLY"
	case "NON_CN_ONLY":
		return "NON_CN_ONLY"
	default:
		return "ALL"
	}
}

func allScopesMatch(scopes []string, expected string) bool {
	for _, item := range scopes {
		if strings.TrimSpace(item) != expected {
			return false
		}
	}

	return true
}

func rawResultToOutcome(rawResult string) RegionalOutcome {
	switch strings.TrimSpace(rawResult) {
	case "SUCCESS":
		return RegionalOutcome{Status: "OK", RawResult: rawResult}
	case "BLOCKED":
		return RegionalOutcome{Status: "WARNING", RawResult: rawResult, WarningReason: "BLOCKED"}
	case "HTTP_ERROR":
		return RegionalOutcome{Status: "WARNING", RawResult: rawResult, WarningReason: "HTTP_ERROR"}
	case "SSL_ERROR":
		return RegionalOutcome{Status: "WARNING", RawResult: rawResult, WarningReason: "SSL_ERROR"}
	case "TIMEOUT":
		return RegionalOutcome{Status: "ERROR", RawResult: rawResult}
	case "DNS_ERROR":
		return RegionalOutcome{Status: "ERROR", RawResult: rawResult}
	case "FAILURE":
		return RegionalOutcome{Status: "ERROR", RawResult: rawResult}
	case "":
		return RegionalOutcome{Status: "", RawResult: rawResult}
	default:
		return RegionalOutcome{Status: "WARNING", RawResult: rawResult, WarningReason: "OTHER"}
	}
}

func mergeRegionalOutcome(
	effectiveAccessScope string,
	cn RegionalOutcome,
	global RegionalOutcome,
) (string, string) {
	if effectiveAccessScope == "CN_ONLY" {
		return "CN_ONLY", fallbackStatus(cn.Status)
	}

	if effectiveAccessScope == "NON_CN_ONLY" {
		return "NON_CN_ONLY", fallbackStatus(global.Status)
	}

	if cn.Status == "OK" && global.Status == "OK" {
		return "ALL", "OK"
	}
	if cn.Status == "OK" && global.Status == "ERROR" {
		return "CN_ONLY", "OK"
	}
	if cn.Status == "ERROR" && global.Status == "OK" {
		return "NON_CN_ONLY", "OK"
	}
	if cn.Status == "ERROR" && global.Status == "ERROR" {
		return "ALL", "ERROR"
	}
	if cn.Status == "WARNING" && global.Status == "WARNING" {
		return "ALL", "WARNING"
	}
	if cn.Status == "OK" && global.Status == "WARNING" {
		return "ALL", "WARNING"
	}
	if cn.Status == "WARNING" && global.Status == "OK" {
		return "ALL", "WARNING"
	}
	if cn.Status == "ERROR" && global.Status == "WARNING" {
		return "NON_CN_ONLY", "WARNING"
	}
	if cn.Status == "WARNING" && global.Status == "ERROR" {
		return "CN_ONLY", "WARNING"
	}

	if cn.Status != "" {
		return "CN_ONLY", cn.Status
	}

	if global.Status != "" {
		return "NON_CN_ONLY", global.Status
	}

	return "ALL", "ERROR"
}

func fallbackStatus(status string) string {
	if status == "" {
		return "ERROR"
	}

	return status
}

func shouldRunCNCheck(accessScope string) bool {
	return accessScope == "ALL" || accessScope == "CN_ONLY"
}

func shouldRunGlobalCheck(accessScope string) bool {
	return accessScope == "ALL" || accessScope == "NON_CN_ONLY"
}
