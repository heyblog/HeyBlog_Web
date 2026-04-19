package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync/atomic"
	"time"

	"zhblogs.net/src/config"
	"zhblogs.net/src/handlers"
	"zhblogs.net/src/scheduler"
	"zhblogs.net/src/store"
)

type Store interface {
	ClaimJobs(context.Context, config.Config) ([]store.JobRecord, error)
	TouchRunningJob(context.Context, string, string) (store.JobExecutionState, error)
	MarkJobSucceeded(context.Context, store.JobRecord, map[string]any) error
	MarkJobFailed(context.Context, store.JobRecord, string, string) error
	CreateRetryJob(context.Context, store.JobRecord, time.Time) error
	MarkJobCanceled(context.Context, store.JobRecord, string) error
	UpdateRunningJobResult(context.Context, string, map[string]any) error
	LoadDueSchedules(context.Context, int) ([]store.ScheduleRecord, error)
	InsertScheduledJob(context.Context, store.ScheduleRecord, map[string]any, time.Time) error
	UpdateScheduleRunWindow(context.Context, string, time.Time, time.Time) error
	JobCounts(context.Context) (store.JobCounts, error)
}

type Runner struct {
	cfg         config.Config
	store       Store
	handler     JobHandler
	logger      *log.Logger
	lastSuccess atomic.Int64
}

type JobHandler interface {
	Handle(context.Context, handlers.Runtime, store.JobRecord) (map[string]any, string, error)
}

type jobRuntime struct {
	logger   *log.Logger
	workerID string
	consumer string
	jobID    string
}

func New(
	cfg config.Config,
	storeClient Store,
	handler JobHandler,
	logger *log.Logger,
) *Runner {
	runner := &Runner{
		cfg:     cfg,
		store:   storeClient,
		handler: handler,
		logger:  logger,
	}
	runner.lastSuccess.Store(time.Now().Unix())
	return runner
}

func (r *Runner) StartConsumer(ctx context.Context) {
	r.startConsumer(ctx, 1)
}

func (r *Runner) startConsumer(ctx context.Context, slot int) {
	consumerID := fmt.Sprintf("consumer-%d", slot)
	ticker := time.NewTicker(r.cfg.PollInterval)
	defer ticker.Stop()

	for {
		if err := r.consumeCycle(ctx, consumerID); err != nil {
			r.logger.Printf("consume cycle failed consumer_id=%s err=%v", consumerID, err)
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (r *Runner) StartConsumers(ctx context.Context) {
	concurrency := r.cfg.ConsumeConcurrency
	if concurrency <= 0 {
		concurrency = 1
	}

	for index := 0; index < concurrency; index++ {
		go r.startConsumer(ctx, index+1)
	}
}

func (r *Runner) StartScheduler(ctx context.Context) {
	ticker := time.NewTicker(r.cfg.ScheduleInterval)
	defer ticker.Stop()

	for {
		if err := r.runScheduleCycle(ctx); err != nil {
			r.logger.Printf("schedule cycle failed err=%v", err)
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (r *Runner) StartHeartbeat(ctx context.Context) {
	r.logHeartbeat(ctx)

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.logHeartbeat(ctx)
		}
	}
}

func (r *Runner) LastSuccessTime() time.Time {
	unix := r.lastSuccess.Load()
	if unix <= 0 {
		return time.Unix(0, 0)
	}
	return time.Unix(unix, 0)
}

func (r *Runner) logHeartbeat(ctx context.Context) {
	counts, err := r.store.JobCounts(ctx)
	if err != nil {
		r.logger.Printf("heartbeat pending_jobs=unknown running_jobs=unknown active_jobs=unknown err=%v", err)
		return
	}

	r.logger.Printf(
		"heartbeat pending_jobs=%d running_jobs=%d active_jobs=%d last_success=%s",
		counts.Pending,
		counts.Running,
		counts.Pending+counts.Running,
		r.LastSuccessTime().UTC().Format(time.RFC3339),
	)
}

func (r *Runner) consumeCycle(ctx context.Context, consumerID string) error {
	jobs, err := r.store.ClaimJobs(ctx, r.cfg)
	if err != nil {
		return err
	}

	for _, job := range jobs {
		if processErr := r.consumeOne(ctx, consumerID, job); processErr != nil {
			r.logger.Printf(
				"consume job failed consumer_id=%s id=%s task=%s err=%v",
				consumerID,
				job.ID,
				job.TaskType,
				processErr,
			)
		}
	}

	return nil
}

func (r *Runner) consumeOne(ctx context.Context, consumerID string, job store.JobRecord) error {
	runtime := &jobRuntime{
		logger:   r.logger,
		workerID: r.cfg.WorkerID,
		consumer: consumerID,
		jobID:    job.ID,
	}

	runtime.Log(ctx, "INFO", "job.claimed", "claim job for execution", map[string]any{
		"task_type":   job.TaskType,
		"consumer_id": consumerID,
	})

	jobCtx, cancel := context.WithCancel(ctx)
	monitor := r.startJobExecutionMonitor(jobCtx, cancel, runtime, job)
	output, errorCode, processErr := r.handler.Handle(jobCtx, runtime, job)
	cancel()
	monitor.wait()
	return r.finalizeConsumedJob(ctx, runtime, job, monitor, output, errorCode, processErr)
}

func (r *Runner) runScheduleCycle(ctx context.Context) error {
	schedules, err := r.store.LoadDueSchedules(ctx, r.cfg.ScheduleBatch)
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	for _, item := range schedules {
		payload := map[string]any{}
		if len(item.PayloadTemplate) > 0 {
			_ = jsonUnmarshal(item.PayloadTemplate, &payload)
		}
		if item.RequestConfigID != "" {
			payload["request_config_id"] = item.RequestConfigID
		}
		if item.TaskType == "SITE_CHECK" {
			payload = r.decorateSiteCheckPayload(payload)
		}

		if err := r.store.InsertScheduledJob(ctx, item, payload, now); err != nil {
			return err
		}

		nextRunTime := scheduler.ComputeNextRunTime(item, now, r.cfg.Timezone)
		if err := r.store.UpdateScheduleRunWindow(ctx, item.ID, now, nextRunTime); err != nil {
			return err
		}
	}

	return nil
}

func (r *Runner) shouldCreateRetry(job store.JobRecord) bool {
	if r.cfg.JobRetryLimit <= 0 {
		return false
	}

	return job.RetrySequence < r.cfg.JobRetryLimit
}

func (r *jobRuntime) Log(
	_ context.Context,
	level string,
	eventKey string,
	message string,
	payload map[string]any,
) {
	r.logger.Printf(
		"level=%s job_id=%s worker_id=%s consumer_id=%s event=%s message=%s payload=%v",
		level,
		r.jobID,
		r.workerID,
		r.consumer,
		eventKey,
		message,
		payload,
	)
}

func (r *jobRuntime) WorkerID() string {
	return r.workerID
}

func jsonUnmarshal(raw []byte, target *map[string]any) error {
	return json.Unmarshal(raw, target)
}
