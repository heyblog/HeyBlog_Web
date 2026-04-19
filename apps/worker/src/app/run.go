package app

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	cfclient "zhblogs.net/src/cloudflare"
	"zhblogs.net/src/config"
	"zhblogs.net/src/executor"
	"zhblogs.net/src/handlers"
	"zhblogs.net/src/health"
	"zhblogs.net/src/store"
)

func Run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config failed: %w", err)
	}

	logger := log.New(os.Stdout, "[worker] ", log.LstdFlags|log.Lmicroseconds)
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	pool, err := openPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	runner, storeClient := newRunner(cfg, pool, logger)
	logger.Printf(
		"worker started worker_id=%s port=%d poll=%s schedule=%s consume_concurrency=%d",
		cfg.WorkerID,
		cfg.Port,
		cfg.PollInterval.String(),
		cfg.ScheduleInterval.String(),
		cfg.ConsumeConcurrency,
	)

	runner.StartConsumers(ctx)
	go runner.StartScheduler(ctx)
	go runner.StartHeartbeat(ctx)
	go func() {
		if err := health.Start(ctx, cfg.Port, cfg.WorkerID, storeClient, runner); err != nil {
			logger.Printf("health server stopped err=%v", err)
		}
	}()

	<-ctx.Done()
	logger.Printf("worker shutting down")
	return nil
}

func openPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect database failed: %w", err)
	}

	pingCtx, pingCancel := context.WithTimeout(ctx, 5*time.Second)
	defer pingCancel()
	if err = pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database failed: %w", err)
	}

	return pool, nil
}

func newRunner(
	cfg config.Config,
	pool *pgxpool.Pool,
	logger *log.Logger,
) (*executor.Runner, *store.Store) {
	storeClient := store.New(pool)
	handlerService := handlers.NewWithOptions(
		storeClient,
		cfclient.New(cfg),
		handlers.ServiceOptions{
			SiteCheckBatchConcurrency: cfg.SiteCheckBatchConcurrency,
			RSSFetchBatchConcurrency:  cfg.RSSFetchBatchConcurrency,
			APIBaseURL:                cfg.APIBaseURL,
			APIInternalToken:          cfg.APIInternalToken,
			APIRequestTimeout:         cfg.APIRequestTimeout,
		},
	)

	return executor.New(cfg, storeClient, handlerService, logger), storeClient
}
