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

type blockingHandler struct{}

func (blockingHandler) Handle(
	ctx context.Context,
	_ handlers.Runtime,
	_ workerstore.JobRecord,
) (map[string]any, string, error) {
	<-ctx.Done()
	return nil, "", ctx.Err()
}

type jobControlStoreStub struct {
	mu              sync.Mutex
	jobs            []workerstore.JobRecord
	claimCount      int
	heartbeatCount  int
	cancelRequested bool
	succeeded       int
	failed          int
	canceled        int
	done            chan string
}

func (s *jobControlStoreStub) ClaimJobs(context.Context, config.Config) ([]workerstore.JobRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.claimCount > 0 {
		return nil, nil
	}
	s.claimCount++
	return append([]workerstore.JobRecord(nil), s.jobs...), nil
}

func (s *jobControlStoreStub) TouchRunningJob(
	context.Context,
	string,
	string,
) (workerstore.JobExecutionState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.heartbeatCount++
	return workerstore.JobExecutionState{
		CancelRequested: s.cancelRequested,
		CancelReason:    "Canceled from management panel.",
	}, nil
}

func (s *jobControlStoreStub) MarkJobSucceeded(context.Context, workerstore.JobRecord, map[string]any) error {
	s.mu.Lock()
	s.succeeded++
	s.mu.Unlock()
	s.done <- "SUCCEEDED"
	return nil
}

func (s *jobControlStoreStub) MarkJobFailed(context.Context, workerstore.JobRecord, string, string) error {
	s.mu.Lock()
	s.failed++
	s.mu.Unlock()
	s.done <- "FAILED"
	return nil
}

func (s *jobControlStoreStub) CreateRetryJob(context.Context, workerstore.JobRecord, time.Time) error {
	return nil
}

func (s *jobControlStoreStub) MarkJobCanceled(context.Context, workerstore.JobRecord, string) error {
	s.mu.Lock()
	s.canceled++
	s.mu.Unlock()
	s.done <- "CANCELED"
	return nil
}

func (s *jobControlStoreStub) UpdateRunningJobResult(context.Context, string, map[string]any) error {
	return nil
}

func (s *jobControlStoreStub) LoadDueSchedules(context.Context, int) ([]workerstore.ScheduleRecord, error) {
	return nil, nil
}

func (s *jobControlStoreStub) InsertScheduledJob(
	context.Context,
	workerstore.ScheduleRecord,
	map[string]any,
	time.Time,
) error {
	return nil
}

func (s *jobControlStoreStub) UpdateScheduleRunWindow(context.Context, string, time.Time, time.Time) error {
	return nil
}

func (s *jobControlStoreStub) JobCounts(context.Context) (workerstore.JobCounts, error) {
	return workerstore.JobCounts{}, nil
}

func (s *jobControlStoreStub) snapshot() (heartbeats int, succeeded int, failed int, canceled int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.heartbeatCount, s.succeeded, s.failed, s.canceled
}

func waitForHeartbeat(t *testing.T, storeStub *jobControlStoreStub) {
	t.Helper()
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		heartbeats, _, _, _ := storeStub.snapshot()
		if heartbeats > 0 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("expected heartbeat before timeout")
}

func TestRunnerMarksJobCanceledAfterCooperativeCancelRequest(t *testing.T) {
	storeStub := &jobControlStoreStub{
		jobs:            []workerstore.JobRecord{{ID: "job-1", TaskType: "SITE_CHECK", TriggerSource: "MANUAL"}},
		done:            make(chan string, 1),
		cancelRequested: true,
	}

	runner := executor.New(
		config.Config{
			WorkerID:             "worker-test",
			PollInterval:         10 * time.Millisecond,
			JobHeartbeatInterval: 10 * time.Millisecond,
		},
		storeStub,
		blockingHandler{},
		log.New(io.Discard, "", 0),
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go runner.StartConsumer(ctx)

	select {
	case status := <-storeStub.done:
		if status != "CANCELED" {
			t.Fatalf("expected CANCELED status, got %s", status)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("runner did not cancel job")
	}
}

func TestRunnerLeavesJobRunningWhenWorkerContextStops(t *testing.T) {
	storeStub := &jobControlStoreStub{
		jobs: []workerstore.JobRecord{{ID: "job-1", TaskType: "SITE_CHECK", TriggerSource: "MANUAL"}},
		done: make(chan string, 1),
	}

	runner := executor.New(
		config.Config{
			WorkerID:             "worker-test",
			PollInterval:         10 * time.Millisecond,
			JobHeartbeatInterval: 10 * time.Millisecond,
		},
		storeStub,
		blockingHandler{},
		log.New(io.Discard, "", 0),
	)

	ctx, cancel := context.WithCancel(context.Background())
	go runner.StartConsumer(ctx)
	waitForHeartbeat(t, storeStub)

	cancel()
	time.Sleep(40 * time.Millisecond)

	select {
	case status := <-storeStub.done:
		t.Fatalf("expected no terminal status, got %s", status)
	default:
	}

	_, succeeded, failed, canceled := storeStub.snapshot()
	if succeeded != 0 || failed != 0 || canceled != 0 {
		t.Fatalf("expected interrupted job to remain non-terminal, got succeeded=%d failed=%d canceled=%d", succeeded, failed, canceled)
	}
}
