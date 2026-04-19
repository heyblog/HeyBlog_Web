package health

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"zhblogs.net/src/executor"
	workerstore "zhblogs.net/src/store"
)

type StatusReader interface {
	JobCounts(context.Context) (workerstore.JobCounts, error)
}

type Response struct {
	OK              bool   `json:"ok"`
	Service         string `json:"service"`
	Check           string `json:"check"`
	WorkerID        string `json:"worker_id"`
	LastSuccessTime string `json:"last_success_time,omitempty"`
	PendingJobs     int    `json:"pending_jobs"`
	RunningJobs     int    `json:"running_jobs"`
	ActiveJobs      int    `json:"active_jobs"`
}

func Start(ctx context.Context, port int, workerID string, store StatusReader, runner *executor.Runner) error {
	mux := http.NewServeMux()
	handler := func(writer http.ResponseWriter, _ *http.Request) {
		writeHealth(ctx, writer, workerID, store, runner)
	}
	mux.HandleFunc("/health", handler)
	mux.HandleFunc("/health/worker", handler)

	server := &http.Server{
		Addr:    ":" + intToString(port),
		Handler: mux,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func writeHealth(
	ctx context.Context,
	writer http.ResponseWriter,
	workerID string,
	store StatusReader,
	runner *executor.Runner,
) {
	counts, err := store.JobCounts(ctx)
	if err != nil {
		counts = workerstore.JobCounts{
			Pending: -1,
			Running: -1,
		}
	}

	lastSuccess := runner.LastSuccessTime()
	isFresh := time.Since(lastSuccess) <= 30*time.Minute
	isBacklogSafe := counts.Pending >= 0 && counts.Pending <= 500
	isHealthy := isFresh && isBacklogSafe

	status := http.StatusOK
	check := "ready"
	if !isHealthy {
		status = http.StatusServiceUnavailable
		check = "degraded"
	}

	activeJobs := -1
	if counts.Pending >= 0 && counts.Running >= 0 {
		activeJobs = counts.Pending + counts.Running
	}

	response := Response{
		OK:          isHealthy,
		Service:     "worker",
		Check:       check,
		WorkerID:    workerID,
		PendingJobs: counts.Pending,
		RunningJobs: counts.Running,
		ActiveJobs:  activeJobs,
	}
	if !lastSuccess.IsZero() {
		response.LastSuccessTime = lastSuccess.UTC().Format(time.RFC3339)
	}

	writer.Header().Set("content-type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(response)
}

func intToString(value int) string {
	if value <= 0 {
		return "9301"
	}
	return strconv.Itoa(value)
}
