package scheduler

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/robfig/cron/v3"

	"zhblogs.net/src/store"
)

type Config struct {
	Cron            string `json:"cron"`
	IntervalSeconds int    `json:"interval_seconds"`
	Timezone        string `json:"timezone"`
}

func ComputeNextRunTime(
	item store.ScheduleRecord,
	now time.Time,
	fallbackTZ *time.Location,
) time.Time {
	cfg := Config{}
	if len(item.ScheduleConfig) > 0 {
		_ = json.Unmarshal(item.ScheduleConfig, &cfg)
	}

	location := resolveLocation(cfg.Timezone, fallbackTZ)

	switch item.ScheduleMode {
	case "INTERVAL":
		intervalSeconds := cfg.IntervalSeconds
		if intervalSeconds <= 0 {
			intervalSeconds = 3600
		}
		return now.Add(time.Duration(intervalSeconds) * time.Second)
	case "CRON":
		expression := cfg.Cron
		if expression == "" {
			expression = "0 */6 * * *"
		}

		parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
		schedule, err := parser.Parse(expression)
		if err != nil {
			return now.Add(6 * time.Hour)
		}

		nextLocal := schedule.Next(now.In(location))
		return nextLocal.UTC()
	default:
		return now.Add(6 * time.Hour)
	}
}

func ResolveScheduleLocation(item store.ScheduleRecord, fallbackTZ *time.Location) *time.Location {
	cfg := Config{}
	if len(item.ScheduleConfig) > 0 {
		_ = json.Unmarshal(item.ScheduleConfig, &cfg)
	}

	return resolveLocation(cfg.Timezone, fallbackTZ)
}

func MatchSubCron(expression string, now time.Time, location *time.Location) bool {
	trimmed := strings.TrimSpace(expression)
	if trimmed == "" {
		return false
	}

	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	schedule, err := parser.Parse(trimmed)
	if err != nil {
		return false
	}

	localNow := now.In(location)
	previous := localNow.Add(-time.Minute)
	nextRun := schedule.Next(previous)
	return !nextRun.After(localNow)
}

func resolveLocation(timezone string, fallbackTZ *time.Location) *time.Location {
	if timezone != "" {
		if tz, err := time.LoadLocation(timezone); err == nil {
			return tz
		}
	}

	return fallbackTZ
}
