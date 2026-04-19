package unit_test

import (
	"testing"
	"time"

	"zhblogs.net/src/config"
	"zhblogs.net/src/scheduler"
	"zhblogs.net/src/store"
)

func TestLoadConfigAppliesDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://worker:test@127.0.0.1:5432/zhblogs")
	t.Setenv("TZ", "Asia/Shanghai")
	t.Setenv("WORKER_ID", "")
	t.Setenv("WORKER_PORT", "")
	t.Setenv("WORKER_POLL_INTERVAL_MS", "")
	t.Setenv("WORKER_SCHEDULE_INTERVAL_MS", "")
	t.Setenv("WORKER_CONSUME_BATCH", "")
	t.Setenv("WORKER_CONSUME_CONCURRENCY", "")
	t.Setenv("WORKER_SCHEDULE_BATCH", "")
	t.Setenv("WORKER_SITE_CHECK_BATCH_CONCURRENCY", "")
	t.Setenv("WORKER_RSS_FETCH_BATCH_CONCURRENCY", "")
	t.Setenv("WORKER_CALLBACK_URL", "http://127.0.0.1:9501")
	t.Setenv("WORKER_CALLBACK_SECRET", "secret")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("load config: %v", err)
	}

	if cfg.Port != 9301 {
		t.Fatalf("expected worker port 9301, got %d", cfg.Port)
	}

	if cfg.ConsumeBatch != 1 {
		t.Fatalf("expected default consume batch 1, got %d", cfg.ConsumeBatch)
	}

	if cfg.ConsumeConcurrency != 4 {
		t.Fatalf("expected default consume concurrency 4, got %d", cfg.ConsumeConcurrency)
	}

	if cfg.ScheduleBatch != 50 {
		t.Fatalf("expected default schedule batch 50, got %d", cfg.ScheduleBatch)
	}

	if cfg.JobRetryLimit != 2 {
		t.Fatalf("expected default job retry limit 2, got %d", cfg.JobRetryLimit)
	}

	if cfg.JobRetryDelay != 5*time.Second {
		t.Fatalf("expected default job retry delay 5s, got %s", cfg.JobRetryDelay)
	}

	if cfg.SiteCheckBatchConcurrency != 4 {
		t.Fatalf("expected site check concurrency 4, got %d", cfg.SiteCheckBatchConcurrency)
	}

	if cfg.RSSFetchBatchConcurrency != 4 {
		t.Fatalf("expected rss fetch concurrency 4, got %d", cfg.RSSFetchBatchConcurrency)
	}

	if cfg.CallbackTimeout != 5*time.Second {
		t.Fatalf("expected callback timeout 5s, got %s", cfg.CallbackTimeout)
	}

	if cfg.Timezone == nil || cfg.Timezone.String() != "Asia/Shanghai" {
		t.Fatalf("expected Asia/Shanghai timezone, got %v", cfg.Timezone)
	}
}

func TestComputeNextRunTime(t *testing.T) {
	now := time.Date(2026, 4, 13, 1, 15, 0, 0, time.UTC)
	shanghai := time.FixedZone("CST", 8*60*60)

	intervalNext := scheduler.ComputeNextRunTime(
		store.ScheduleRecord{
			ScheduleMode:   "INTERVAL",
			ScheduleConfig: []byte(`{"interval_seconds":1800}`),
		},
		now,
		shanghai,
	)
	if !intervalNext.Equal(now.Add(30 * time.Minute)) {
		t.Fatalf("expected interval next run %s, got %s", now.Add(30*time.Minute), intervalNext)
	}

	cronNext := scheduler.ComputeNextRunTime(
		store.ScheduleRecord{
			ScheduleMode:   "CRON",
			ScheduleConfig: []byte(`{"cron":"0 10 * * *","timezone":"Asia/Shanghai"}`),
		},
		now,
		time.UTC,
	)

	expectedCron := time.Date(2026, 4, 13, 2, 0, 0, 0, time.UTC)
	if !cronNext.Equal(expectedCron) {
		t.Fatalf("expected cron next run %s, got %s", expectedCron, cronNext)
	}
}

func TestMatchSubCron(t *testing.T) {
	location := time.FixedZone("CST", 8*60*60)
	now := time.Date(2026, 4, 13, 10, 0, 0, 0, location)

	if !scheduler.MatchSubCron("0 10 * * *", now, location) {
		t.Fatal("expected sub cron to match current minute")
	}

	if scheduler.MatchSubCron("5 10 * * *", now, location) {
		t.Fatal("expected different minute cron to not match")
	}
}
