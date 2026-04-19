package executor

import (
	"encoding/json"
)

func (r *Runner) decorateSiteCheckPayload(payload map[string]any) map[string]any {
	options := readPayloadOptions(payload)
	options["run_content_validation"] = readBoolOption(options, "run_content_validation")
	options["run_global_check"] = readBoolOption(options, "run_global_check")
	options["run_full_check"] = readBoolOption(options, "run_full_check")
	payload["options"] = options

	return payload
}

func readPayloadOptions(payload map[string]any) map[string]any {
	rawOptions, ok := payload["options"].(map[string]any)
	if ok {
		return rawOptions
	}

	options := map[string]any{}
	if raw, ok := payload["options"]; ok {
		encoded, err := json.Marshal(raw)
		if err == nil {
			_ = json.Unmarshal(encoded, &options)
		}
	}

	return options
}

func readBoolOption(options map[string]any, key string) bool {
	value, ok := options[key].(bool)
	if !ok {
		return false
	}

	return value
}
