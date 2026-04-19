package executor

import (
	"context"
	"errors"
	"strings"
	"time"

	"zhblogs.net/src/store"
)

type jobExecutionMonitor struct {
	cancelRequested bool
	cancelReason    string
	done            chan struct{}
}

func (r *Runner) startJobExecutionMonitor(
	ctx context.Context,
	cancel context.CancelFunc,
	runtime *jobRuntime,
	job store.JobRecord,
) *jobExecutionMonitor {
	monitor := &jobExecutionMonitor{done: make(chan struct{})}
	go r.watchJobExecution(ctx, cancel, runtime, job, monitor)
	return monitor
}

func (r *Runner) watchJobExecution(
	ctx context.Context,
	cancel context.CancelFunc,
	runtime *jobRuntime,
	job store.JobRecord,
	monitor *jobExecutionMonitor,
) {
	defer close(monitor.done)
	ticker := time.NewTicker(resolveJobHeartbeatInterval(r.cfg.JobHeartbeatInterval))
	defer ticker.Stop()

	for {
		state, err := r.store.TouchRunningJob(ctx, job.ID, r.cfg.WorkerID)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			runtime.Log(ctx, "WARN", "job.heartbeat_failed", "touch running job failed", map[string]any{
				"error": err.Error(),
			})
		} else if state.CancelRequested {
			monitor.cancelRequested = true
			monitor.cancelReason = resolveCancelReason(state.CancelReason)
			runtime.Log(ctx, "INFO", "job.cancel_requested", "job cancel requested", map[string]any{})
			cancel()
			return
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (m *jobExecutionMonitor) wait() {
	<-m.done
}

func (r *Runner) jobFinalizeContext() context.Context {
	return context.Background()
}

func (r *Runner) finalizeConsumedJob(
	ctx context.Context,
	runtime *jobRuntime,
	job store.JobRecord,
	monitor *jobExecutionMonitor,
	output map[string]any,
	errorCode string,
	processErr error,
) error {
	if processErr == nil {
		return r.markJobSucceeded(job, output)
	}
	if monitor.cancelRequested {
		return r.store.MarkJobCanceled(r.jobFinalizeContext(), job, monitor.cancelReason)
	}
	if ctx.Err() != nil && errors.Is(processErr, context.Canceled) {
		runtime.Log(ctx, "INFO", "job.interrupted", "job interrupted before finalize", map[string]any{})
		return nil
	}
	return r.markJobFailed(job, errorCode, processErr)
}

func (r *Runner) markJobSucceeded(job store.JobRecord, output map[string]any) error {
	if output == nil {
		output = map[string]any{}
	}
	if err := r.store.MarkJobSucceeded(r.jobFinalizeContext(), job, output); err != nil {
		return err
	}
	r.lastSuccess.Store(time.Now().Unix())
	return nil
}

func (r *Runner) markJobFailed(job store.JobRecord, errorCode string, processErr error) error {
	if strings.TrimSpace(errorCode) == "" {
		errorCode = "FAILURE"
	}
	if err := r.store.MarkJobFailed(r.jobFinalizeContext(), job, errorCode, processErr.Error()); err != nil {
		return err
	}
	if !r.shouldCreateRetry(job) {
		return processErr
	}
	retryTime := time.Now().Add(r.cfg.JobRetryDelay)
	if err := r.store.CreateRetryJob(r.jobFinalizeContext(), job, retryTime); err != nil {
		return err
	}
	return processErr
}

func resolveCancelReason(reason string) string {
	if strings.TrimSpace(reason) == "" {
		return "Canceled from management panel."
	}

	return strings.TrimSpace(reason)
}

func resolveJobHeartbeatInterval(interval time.Duration) time.Duration {
	if interval <= 0 {
		return 5 * time.Second
	}

	return interval
}
