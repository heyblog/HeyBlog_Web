package integration_test

import (
	"context"
	"io"
	"log"
	"sync"
	"testing"
	"time"

	"zhblogs.net/src/config"
	"zhblogs.net/src/executor"
	"zhblogs.net/src/handlers"
	workerstore "zhblogs.net/src/store"
)

type runnerStoreStub struct {
	mu               sync.Mutex
	jobs             []workerstore.JobRecord
	dueSchedules     []workerstore.ScheduleRecord
	claimCount       int
	scheduleCount    int
	scheduledInserts int
	scheduleUpdates  int
	heartbeats       []string
	failed           []string
	succeeded        []string
	retried          []string
	canceled         []string
	insertedPayloads []map[string]any
	done             chan string
}

func (s *runnerStoreStub) ClaimJobs(context.Context, config.Config) ([]workerstore.JobRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.claimCount > 0 {
		return nil, nil
	}
	s.claimCount++
	return append([]workerstore.JobRecord(nil), s.jobs...), nil
}

func (s *runnerStoreStub) TouchRunningJob(
	_ context.Context,
	jobID string,
	_ string,
) (workerstore.JobExecutionState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.heartbeats = append(s.heartbeats, jobID)
	return workerstore.JobExecutionState{}, nil
}

func (s *runnerStoreStub) MarkJobSucceeded(_ context.Context, job workerstore.JobRecord, _ map[string]any) error {
	s.mu.Lock()
	s.succeeded = append(s.succeeded, job.ID)
	s.mu.Unlock()
	s.done <- "SUCCEEDED"
	return nil
}

func (s *runnerStoreStub) MarkJobFailed(
	_ context.Context,
	job workerstore.JobRecord,
	_ string,
	_ string,
) error {
	s.mu.Lock()
	s.failed = append(s.failed, job.ID)
	s.mu.Unlock()
	s.done <- "FAILED"
	return nil
}

func (s *runnerStoreStub) CreateRetryJob(_ context.Context, job workerstore.JobRecord, _ time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.retried = append(s.retried, job.ID)
	return nil
}

func (s *runnerStoreStub) MarkJobCanceled(_ context.Context, job workerstore.JobRecord, _ string) error {
	s.mu.Lock()
	s.canceled = append(s.canceled, job.ID)
	s.mu.Unlock()
	s.done <- "CANCELED"
	return nil
}

func (s *runnerStoreStub) UpdateRunningJobResult(context.Context, string, map[string]any) error {
	return nil
}

func (s *runnerStoreStub) LoadDueSchedules(context.Context, int) ([]workerstore.ScheduleRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.scheduleCount > 0 || len(s.dueSchedules) == 0 {
		return nil, nil
	}

	s.scheduleCount++
	return append([]workerstore.ScheduleRecord(nil), s.dueSchedules...), nil
}

func (s *runnerStoreStub) InsertScheduledJob(
	_ context.Context,
	_ workerstore.ScheduleRecord,
	payload map[string]any,
	_ time.Time,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.scheduledInserts++
	s.insertedPayloads = append(s.insertedPayloads, payload)
	return nil
}

func (s *runnerStoreStub) UpdateScheduleRunWindow(context.Context, string, time.Time, time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.scheduleUpdates++
	return nil
}

func (s *runnerStoreStub) JobCounts(context.Context) (workerstore.JobCounts, error) {
	return workerstore.JobCounts{}, nil
}

func (s *runnerStoreStub) snapshot() (heartbeats int, failed int, succeeded int, inserted int, updates int, payloads []map[string]any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.heartbeats), len(s.failed), len(s.succeeded), s.scheduledInserts, s.scheduleUpdates, append([]map[string]any(nil), s.insertedPayloads...)
}

type parallelRunnerStoreStub struct {
	mu      sync.Mutex
	jobs    []workerstore.JobRecord
	next    int
	active  int
	max     int
	failed  []string
	release chan struct{}
}

func newParallelRunnerStoreStub(jobs []workerstore.JobRecord) *parallelRunnerStoreStub {
	return &parallelRunnerStoreStub{
		jobs:    jobs,
		release: make(chan struct{}),
	}
}

func (s *parallelRunnerStoreStub) ClaimJobs(context.Context, config.Config) ([]workerstore.JobRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.next >= len(s.jobs) {
		return nil, nil
	}

	job := s.jobs[s.next]
	s.next++
	return []workerstore.JobRecord{job}, nil
}

func (s *parallelRunnerStoreStub) TouchRunningJob(
	context.Context,
	string,
	string,
) (workerstore.JobExecutionState, error) {
	return workerstore.JobExecutionState{}, nil
}
func (s *parallelRunnerStoreStub) CreateRetryJob(context.Context, workerstore.JobRecord, time.Time) error {
	return nil
}
func (s *parallelRunnerStoreStub) MarkJobCanceled(context.Context, workerstore.JobRecord, string) error {
	return nil
}
func (s *parallelRunnerStoreStub) UpdateRunningJobResult(context.Context, string, map[string]any) error {
	return nil
}
func (s *parallelRunnerStoreStub) LoadDueSchedules(context.Context, int) ([]workerstore.ScheduleRecord, error) {
	return nil, nil
}
func (s *parallelRunnerStoreStub) InsertScheduledJob(context.Context, workerstore.ScheduleRecord, map[string]any, time.Time) error {
	return nil
}
func (s *parallelRunnerStoreStub) UpdateScheduleRunWindow(context.Context, string, time.Time, time.Time) error {
	return nil
}
func (s *parallelRunnerStoreStub) JobCounts(context.Context) (workerstore.JobCounts, error) {
	return workerstore.JobCounts{}, nil
}
func (s *parallelRunnerStoreStub) MarkJobSucceeded(context.Context, workerstore.JobRecord, map[string]any) error {
	return nil
}

func (s *parallelRunnerStoreStub) MarkJobFailed(
	_ context.Context,
	job workerstore.JobRecord,
	_ string,
	_ string,
) error {
	s.mu.Lock()
	s.active++
	if s.active > s.max {
		s.max = s.active
	}
	s.mu.Unlock()

	<-s.release

	s.mu.Lock()
	s.active--
	s.failed = append(s.failed, job.ID)
	s.mu.Unlock()
	return nil
}

func (s *parallelRunnerStoreStub) releaseAll() {
	close(s.release)
}

func (s *parallelRunnerStoreStub) snapshot() (maxActive int, failed int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.max, len(s.failed)
}

func waitForParallelState(
	t *testing.T,
	storeStub *parallelRunnerStoreStub,
	check func(maxActive int, failed int) bool,
	label string,
) {
	t.Helper()

	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		maxActive, failed := storeStub.snapshot()
		if check(maxActive, failed) {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}

	maxActive, failed := storeStub.snapshot()
	t.Fatalf("%s not reached: max_active=%d failed=%d", label, maxActive, failed)
}

func TestRunnerMarksUnsupportedTaskAsFailed(t *testing.T) {
	storeStub := &runnerStoreStub{
		jobs: []workerstore.JobRecord{{
			ID:            "job-1",
			TaskType:      "CUSTOM",
			TriggerSource: "MANUAL",
			Payload:       []byte(`{}`),
		}},
		done: make(chan string, 1),
	}

	runner := executor.New(
		config.Config{
			WorkerID:     "worker-test",
			PollInterval: 10 * time.Millisecond,
		},
		storeStub,
		handlers.New(nil, nil, 1, 1),
		log.New(io.Discard, "", 0),
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go runner.StartConsumer(ctx)

	select {
	case status := <-storeStub.done:
		if status != "FAILED" {
			t.Fatalf("expected FAILED status, got %s", status)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("runner did not finish job")
	}

	cancel()
	time.Sleep(20 * time.Millisecond)

	heartbeats, failed, succeeded, _, _, _ := storeStub.snapshot()
	if heartbeats != 1 {
		t.Fatalf("expected 1 heartbeat, got %d", heartbeats)
	}
	if failed != 1 {
		t.Fatalf("expected 1 failed job, got %d", failed)
	}
	if succeeded != 0 {
		t.Fatalf("expected 0 succeeded jobs, got %d", succeeded)
	}
}

func TestRunnerSchedulerInsertsScheduledJobWithRequestConfig(t *testing.T) {
	storeStub := &runnerStoreStub{
		dueSchedules: []workerstore.ScheduleRecord{{
			ID:              "schedule-1",
			TaskType:        "SITE_CHECK",
			ScheduleMode:    "INTERVAL",
			RequestConfigID: "33333333-3333-4333-8333-333333333333",
			ScheduleConfig:  []byte(`{"interval_seconds":30}`),
			PayloadTemplate: []byte(`{"target":{"kind":"ALL_VISIBLE"}}`),
		}},
		done: make(chan string, 1),
	}

	runner := executor.New(
		config.Config{
			WorkerID:         "worker-test",
			ScheduleInterval: 10 * time.Millisecond,
			Timezone:         time.UTC,
		},
		storeStub,
		handlers.New(nil, nil, 1, 1),
		log.New(io.Discard, "", 0),
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go runner.StartScheduler(ctx)

	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		_, _, _, inserts, updates, _ := storeStub.snapshot()
		if inserts > 0 && updates > 0 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	cancel()
	time.Sleep(20 * time.Millisecond)

	_, _, _, inserts, updates, payloads := storeStub.snapshot()
	if inserts != 1 {
		t.Fatalf("expected 1 scheduled insert, got %d", inserts)
	}
	if updates != 1 {
		t.Fatalf("expected 1 schedule window update, got %d", updates)
	}
	if len(payloads) != 1 {
		t.Fatalf("expected 1 captured payload, got %d", len(payloads))
	}

	if payloads[0]["request_config_id"] != "33333333-3333-4333-8333-333333333333" {
		t.Fatalf("expected request_config_id to be injected, got %#v", payloads[0]["request_config_id"])
	}
}

func TestRunnerStartConsumersProcessesJobsInParallel(t *testing.T) {
	storeStub := newParallelRunnerStoreStub([]workerstore.JobRecord{
		{ID: "job-1", TaskType: "CUSTOM", TriggerSource: "MANUAL", Payload: []byte(`{}`)},
		{ID: "job-2", TaskType: "CUSTOM", TriggerSource: "MANUAL", Payload: []byte(`{}`)},
	})

	runner := executor.New(
		config.Config{
			WorkerID:           "worker-test",
			PollInterval:       10 * time.Millisecond,
			ConsumeConcurrency: 2,
		},
		storeStub,
		handlers.New(nil, nil, 1, 1),
		log.New(io.Discard, "", 0),
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	runner.StartConsumers(ctx)
	waitForParallelState(t, storeStub, func(maxActive int, _ int) bool {
		return maxActive >= 2
	}, "parallel consumption")

	storeStub.releaseAll()
	waitForParallelState(t, storeStub, func(_ int, failed int) bool {
		return failed == 2
	}, "job completion")

	cancel()
	time.Sleep(20 * time.Millisecond)

	maxActive, failed := storeStub.snapshot()
	if maxActive != 2 {
		t.Fatalf("expected max active jobs 2, got %d", maxActive)
	}
	if failed != 2 {
		t.Fatalf("expected 2 failed jobs, got %d", failed)
	}
}
