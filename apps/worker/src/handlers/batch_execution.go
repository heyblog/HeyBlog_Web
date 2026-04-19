package handlers

import (
	"context"
	"sync"
	"time"

	"zhblogs.net/src/store"
)

type batchProgress struct {
	totalCount     int
	processedCount int
	successCount   int
	failureCount   int
	failureSamples []map[string]any
}

type siteCheckTargetResult struct {
	batchSlot  int
	target     store.SiteTarget
	row        store.SiteCheckRunRow
	resultCode string
	resultErr  error
}

type rssFetchTargetResult struct {
	batchSlot int
	target    store.SiteTarget
	row       store.RSSFetchRunRow
	resultErr error
}

func (s *Service) runSiteCheckBatch(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
	targets []store.SiteTarget,
	progress *batchProgress,
) (map[string]any, string, error) {
	if progress == nil {
		progress = newBatchProgress(len(targets))
	}
	if len(targets) == 0 {
		return progress.output("SITE_CHECK"), "", nil
	}

	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	results := s.startSiteCheckWorkers(runCtx, runtime, job, payload, targets)
	persistErr := s.collectSiteCheckResults(ctx, runtime, job.ID, progress, results, cancel)
	if persistErr != nil {
		return nil, "SITE_CHECK_PERSIST_FAILED", persistErr
	}

	return progress.output("SITE_CHECK"), "", nil
}

func (s *Service) runRSSFetchBatch(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
	targets []store.SiteTarget,
	progress *batchProgress,
) (map[string]any, string, error) {
	if progress == nil {
		progress = newBatchProgress(len(targets))
	}
	if len(targets) == 0 {
		return progress.output("RSS_FETCH"), "", nil
	}

	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	results := s.startRSSFetchWorkers(runCtx, runtime, job, payload, targets)
	persistErr := s.collectRSSFetchResults(ctx, runtime, job.ID, progress, results, cancel)
	if persistErr != nil {
		return nil, "RSS_FETCH_PERSIST_FAILED", persistErr
	}

	return progress.output("RSS_FETCH"), "", nil
}

func (s *Service) startSiteCheckWorkers(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
	targets []store.SiteTarget,
) <-chan siteCheckTargetResult {
	workerCount := resolveBatchWorkerCount(s.siteCheckBatchConcurrency, len(targets))
	targetCh := startTargetDispatch(ctx, targets)
	resultCh := make(chan siteCheckTargetResult, workerCount)
	s.startSiteCheckWorkerGroup(ctx, runtime, job, payload, workerCount, targetCh, resultCh)
	return resultCh
}

func (s *Service) startRSSFetchWorkers(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
	targets []store.SiteTarget,
) <-chan rssFetchTargetResult {
	workerCount := resolveBatchWorkerCount(s.rssFetchBatchConcurrency, len(targets))
	targetCh := startTargetDispatch(ctx, targets)
	resultCh := make(chan rssFetchTargetResult, workerCount)
	s.startRSSFetchWorkerGroup(ctx, runtime, job, payload, workerCount, targetCh, resultCh)
	return resultCh
}

func startTargetDispatch(ctx context.Context, targets []store.SiteTarget) <-chan store.SiteTarget {
	targetCh := make(chan store.SiteTarget)
	go func() {
		defer close(targetCh)
		for _, target := range targets {
			select {
			case <-ctx.Done():
				return
			case targetCh <- target:
			}
		}
	}()
	return targetCh
}

func (s *Service) startSiteCheckWorkerGroup(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
	workerCount int,
	targetCh <-chan store.SiteTarget,
	resultCh chan<- siteCheckTargetResult,
) {
	var wg sync.WaitGroup
	for slot := 1; slot <= workerCount; slot++ {
		wg.Add(1)
		go s.runSiteCheckWorker(ctx, runtime, job, payload, slot, targetCh, resultCh, &wg)
	}
	go closeResultsWhenDone(resultCh, &wg)
}

func (s *Service) startRSSFetchWorkerGroup(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
	workerCount int,
	targetCh <-chan store.SiteTarget,
	resultCh chan<- rssFetchTargetResult,
) {
	var wg sync.WaitGroup
	for slot := 1; slot <= workerCount; slot++ {
		wg.Add(1)
		go s.runRSSFetchWorker(ctx, runtime, job, payload, slot, targetCh, resultCh, &wg)
	}
	go closeResultsWhenDone(resultCh, &wg)
}

func closeResultsWhenDone[T any](resultCh chan<- T, wg *sync.WaitGroup) {
	wg.Wait()
	close(resultCh)
}

func (s *Service) runSiteCheckWorker(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
	batchSlot int,
	targetCh <-chan store.SiteTarget,
	resultCh chan<- siteCheckTargetResult,
	wg *sync.WaitGroup,
) {
	defer wg.Done()

	for target := range targetCh {
		startedAt := time.Now().UTC()
		row, resultCode, resultErr := s.runSiteCheckForTarget(
			ctx,
			runtime,
			job,
			payload,
			&target,
			startedAt,
		)
		finishedAt := time.Now().UTC()
		row.FinishedTime = &finishedAt
		sendSiteCheckResult(ctx, resultCh, batchSlot, target, row, resultCode, resultErr)
	}
}

func (s *Service) runRSSFetchWorker(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
	batchSlot int,
	targetCh <-chan store.SiteTarget,
	resultCh chan<- rssFetchTargetResult,
	wg *sync.WaitGroup,
) {
	defer wg.Done()

	for target := range targetCh {
		startedAt := time.Now().UTC()
		row, resultErr := s.runRSSFetchForTarget(ctx, runtime, job, payload, &target, startedAt)
		finishedAt := time.Now().UTC()
		row.FinishedTime = &finishedAt
		sendRSSFetchResult(ctx, resultCh, batchSlot, target, row, resultErr)
	}
}

func sendSiteCheckResult(
	ctx context.Context,
	resultCh chan<- siteCheckTargetResult,
	batchSlot int,
	target store.SiteTarget,
	row store.SiteCheckRunRow,
	resultCode string,
	resultErr error,
) {
	select {
	case <-ctx.Done():
	case resultCh <- siteCheckTargetResult{
		batchSlot:  batchSlot,
		target:     target,
		row:        row,
		resultCode: resultCode,
		resultErr:  resultErr,
	}:
	}
}

func sendRSSFetchResult(
	ctx context.Context,
	resultCh chan<- rssFetchTargetResult,
	batchSlot int,
	target store.SiteTarget,
	row store.RSSFetchRunRow,
	resultErr error,
) {
	select {
	case <-ctx.Done():
	case resultCh <- rssFetchTargetResult{
		batchSlot: batchSlot,
		target:    target,
		row:       row,
		resultErr: resultErr,
	}:
	}
}
