package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	cfclient "zhblogs.net/src/cloudflare"
	"zhblogs.net/src/sitecorrection"
	"zhblogs.net/src/store"
)

type Service struct {
	store                     *store.Store
	cloudflare                *cfclient.Client
	siteCorrectionClient      *sitecorrection.Client
	siteCheckBatchConcurrency int
	rssFetchBatchConcurrency  int
}

type ServiceOptions struct {
	SiteCheckBatchConcurrency int
	RSSFetchBatchConcurrency  int
	APIBaseURL                string
	APIInternalToken          string
	APIRequestTimeout         time.Duration
}

func New(
	storeClient *store.Store,
	cloudflareClient *cfclient.Client,
	siteCheckBatchConcurrency int,
	rssFetchBatchConcurrency int,
) *Service {
	return NewWithOptions(storeClient, cloudflareClient, ServiceOptions{
		SiteCheckBatchConcurrency: siteCheckBatchConcurrency,
		RSSFetchBatchConcurrency:  rssFetchBatchConcurrency,
	})
}

func NewWithOptions(
	storeClient *store.Store,
	cloudflareClient *cfclient.Client,
	options ServiceOptions,
) *Service {
	if options.SiteCheckBatchConcurrency <= 0 {
		options.SiteCheckBatchConcurrency = 1
	}
	if options.RSSFetchBatchConcurrency <= 0 {
		options.RSSFetchBatchConcurrency = 1
	}
	if options.APIRequestTimeout <= 0 {
		options.APIRequestTimeout = 5 * time.Second
	}

	return &Service{
		store:      storeClient,
		cloudflare: cloudflareClient,
		siteCorrectionClient: sitecorrection.NewClient(
			strings.TrimRight(options.APIBaseURL, "/"),
			strings.TrimSpace(options.APIInternalToken),
			&http.Client{Timeout: options.APIRequestTimeout},
		),
		siteCheckBatchConcurrency: options.SiteCheckBatchConcurrency,
		rssFetchBatchConcurrency:  options.RSSFetchBatchConcurrency,
	}
}

func (s *Service) Handle(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
) (map[string]any, string, error) {
	payload := JobPayload{}
	if len(job.Payload) > 0 {
		if err := json.Unmarshal(job.Payload, &payload); err != nil {
			return nil, "INVALID_PAYLOAD", fmt.Errorf("unmarshal payload: %w", err)
		}
	}

	switch job.TaskType {
	case "UPSTREAM_SYNC":
		return s.handleUpstreamSync(ctx, runtime, job, payload)
	case "SITE_CHECK":
		return s.handleSiteCheck(ctx, runtime, job, payload)
	case "RSS_FETCH":
		return s.handleRSSFetch(ctx, runtime, job, payload)
	default:
		return nil, "UNSUPPORTED_TASK", fmt.Errorf("unsupported task_type=%s", job.TaskType)
	}
}

func (s *Service) handleSiteCheck(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
) (map[string]any, string, error) {
	targets, err := s.resolveSiteCheckTargets(ctx, payload.Target, payload.Options)
	if err != nil {
		return nil, "INVALID_PAYLOAD", err
	}

	progress, pendingTargets, err := s.prepareSiteCheckResume(ctx, job.ID, targets)
	if err != nil {
		return nil, "SITE_CHECK_RESUME_FAILED", err
	}

	return s.runSiteCheckBatch(ctx, runtime, job, payload, pendingTargets, progress)
}

func (s *Service) handleRSSFetch(
	ctx context.Context,
	runtime Runtime,
	job store.JobRecord,
	payload JobPayload,
) (map[string]any, string, error) {
	targets, err := s.resolveRSSFetchTargets(ctx, payload.Target)
	if err != nil {
		return nil, "INVALID_PAYLOAD", err
	}

	progress, pendingTargets, err := s.prepareRSSFetchResume(ctx, job.ID, targets)
	if err != nil {
		return nil, "RSS_FETCH_RESUME_FAILED", err
	}

	return s.runRSSFetchBatch(ctx, runtime, job, payload, pendingTargets, progress)
}

func (s *Service) resolveSiteCheckTargets(
	ctx context.Context,
	target JobTarget,
	options JobOptions,
) ([]store.SiteTarget, error) {
	if strings.TrimSpace(target.Kind) != "ALL_VISIBLE" {
		return s.resolveExplicitTargets(ctx, target)
	}

	if options.RunFullCheck {
		return s.store.ListVisibleSiteTargets(ctx)
	}

	return s.store.ListNormalVisibleSiteTargets(ctx)
}

func (s *Service) resolveRSSFetchTargets(
	ctx context.Context,
	target JobTarget,
) ([]store.SiteTarget, error) {
	if strings.TrimSpace(target.Kind) != "ALL_VISIBLE" {
		return s.resolveExplicitTargets(ctx, target)
	}

	return s.store.ListNormalVisibleSiteTargets(ctx)
}

func (s *Service) resolveExplicitTargets(ctx context.Context, target JobTarget) ([]store.SiteTarget, error) {
	switch strings.TrimSpace(target.Kind) {
	case "SITE":
		if strings.TrimSpace(target.SiteID) == "" {
			return nil, fmt.Errorf("target.site_id is required")
		}
		item, err := s.store.LoadSiteTarget(ctx, target.SiteID)
		if err != nil {
			return nil, fmt.Errorf("load site target: %w", err)
		}
		return []store.SiteTarget{*item}, nil
	case "SITE_LIST":
		if len(target.SiteIDs) == 0 {
			return nil, fmt.Errorf("target.site_ids is required")
		}
		result := make([]store.SiteTarget, 0, len(target.SiteIDs))
		for _, siteID := range target.SiteIDs {
			item, err := s.store.LoadSiteTarget(ctx, siteID)
			if err != nil {
				return nil, fmt.Errorf("load site target: %w", err)
			}
			result = append(result, *item)
		}
		return result, nil
	default:
		return nil, fmt.Errorf("target.kind is required")
	}
}
