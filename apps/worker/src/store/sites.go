package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

func (s *Store) LoadSiteTarget(ctx context.Context, siteID string) (*SiteTarget, error) {
	row := s.pool.QueryRow(ctx, `
select id, name, url, access_scope, coalesce(sitemap, ''), coalesce(link_page, ''), feed::text
from sites
where id = $1
`, siteID)

	var result SiteTarget
	var feedText string
	if err := row.Scan(
		&result.ID,
		&result.Name,
		&result.URL,
		&result.AccessScope,
		&result.Sitemap,
		&result.LinkPage,
		&feedText,
	); err != nil {
		return nil, fmt.Errorf("scan site target: %w", err)
	}

	if feedText != "" {
		if err := json.Unmarshal([]byte(feedText), &result.Feed); err != nil {
			result.Feed = nil
		}
	}

	return &result, nil
}

func (s *Store) ListVisibleSiteTargets(ctx context.Context) ([]SiteTarget, error) {
	return s.listSiteTargets(
		ctx,
		`
select id, name, url, access_scope, coalesce(sitemap, ''), coalesce(link_page, ''), coalesce(feed::text, '[]')
from sites
where is_show = true
order by id asc
`,
		"visible",
	)
}

func (s *Store) ListNormalVisibleSiteTargets(ctx context.Context) ([]SiteTarget, error) {
	return s.listSiteTargets(
		ctx,
		`
select id, name, url, access_scope, coalesce(sitemap, ''), coalesce(link_page, ''), coalesce(feed::text, '[]')
from sites
where is_show = true
	and status = 'OK'
order by id asc
`,
		"normal visible",
	)
}

func (s *Store) listSiteTargets(
	ctx context.Context,
	query string,
	queryLabel string,
) ([]SiteTarget, error) {
	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("load %s site targets: %w", queryLabel, err)
	}
	defer rows.Close()

	result := make([]SiteTarget, 0, 128)
	for rows.Next() {
		var item SiteTarget
		var feedText string
		if scanErr := rows.Scan(
			&item.ID,
			&item.Name,
			&item.URL,
			&item.AccessScope,
			&item.Sitemap,
			&item.LinkPage,
			&feedText,
		); scanErr != nil {
			return nil, fmt.Errorf("scan %s site target: %w", queryLabel, scanErr)
		}

		if strings.TrimSpace(feedText) != "" {
			_ = json.Unmarshal([]byte(feedText), &item.Feed)
		}

		result = append(result, item)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate %s site targets: %w", queryLabel, err)
	}

	return result, nil
}

func (s *Store) LoadRecentDerivedAccessScopes(ctx context.Context, siteID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
select derived_access_scope
from site_check_runs
where site_id = $1
	and status = 'SUCCEEDED'
	and derived_access_scope is not null
order by created_time desc
limit 3
`, siteID)
	if err != nil {
		return nil, fmt.Errorf("load recent derived access scopes: %w", err)
	}
	defer rows.Close()

	result := make([]string, 0, 3)
	for rows.Next() {
		var scope string
		if scanErr := rows.Scan(&scope); scanErr != nil {
			return nil, fmt.Errorf("scan recent derived access scope: %w", scanErr)
		}
		result = append(result, scope)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate recent derived access scopes: %w", err)
	}

	return result, nil
}

func (s *Store) UpdateSiteDerivedState(ctx context.Context, siteID string, accessScope string, status string) error {
	_, err := s.pool.Exec(ctx, `
update sites
set access_scope = $2,
	status = $3,
	update_time = now()
where id = $1
`, siteID, accessScope, status)
	if err != nil {
		return fmt.Errorf("update site derived state: %w", err)
	}

	return nil
}

func (s *Store) UpsertFeedArticle(ctx context.Context, siteID string, row FeedArticleRow) error {
	sourceBytes, err := json.Marshal(row.Source)
	if err != nil {
		return fmt.Errorf("marshal feed source: %w", err)
	}

	articleID, err := newUUIDV7String()
	if err != nil {
		return fmt.Errorf("generate feed article id: %w", err)
	}

	_, err = s.pool.Exec(ctx, `
insert into feed_articles (
	id,
	site_id,
	guid,
	article_url,
	title,
	summary,
	feed_type,
	source,
	published_time,
	fetched_time
)
values ($1, $2, nullif($3, ''), $4, $5, nullif($6, ''), nullif($7, '')::feed_type_enum, $8, $9, now())
on conflict (site_id, article_url)
do update
set title = excluded.title,
	summary = excluded.summary,
	source = excluded.source,
	published_time = coalesce(excluded.published_time, feed_articles.published_time),
	fetched_time = excluded.fetched_time
`, articleID, siteID, row.GUID, row.ArticleURL, row.Title, row.Summary, row.FeedType, sourceBytes, row.Published)
	if err != nil {
		return fmt.Errorf("upsert feed article: %w", err)
	}

	return nil
}

func (s *Store) InsertSiteCheckRun(ctx context.Context, row SiteCheckRunRow) error {
	runID, err := newUUIDV7String()
	if err != nil {
		return fmt.Errorf("generate site check run id: %w", err)
	}

	probeSummaryBytes, err := json.Marshal(row.ProbeSummary)
	if err != nil {
		return fmt.Errorf("marshal site check probe summary: %w", err)
	}

	contentPayloadBytes, err := json.Marshal(row.ContentValidationPayload)
	if err != nil {
		return fmt.Errorf("marshal site check content validation payload: %w", err)
	}

	_, err = s.pool.Exec(ctx, `
insert into site_check_runs (
	id,
	job_id,
	site_id,
	request_config_id,
	status,
	availability_result,
	verify_result,
	effective_access_scope,
	derived_access_scope,
	derived_status,
	check_mode,
	content_validation_status,
	content_validation_payload,
	probe_summary,
	response_time_ms,
	duration_ms,
	jitter_ms,
	final_url,
	error_code,
	error_message,
	started_time,
	finished_time
)
values (
	$1,
	$2,
	$3,
	nullif($4, '')::uuid,
	$5::run_record_status_enum,
	$6::site_check_result_enum,
	$7::site_verify_result_enum,
	nullif($8, '')::site_access_scope_enum,
	nullif($9, '')::site_access_scope_enum,
	nullif($10, '')::site_status_type_enum,
	nullif($11, '')::site_check_mode_enum,
	nullif($12, '')::content_validation_status_enum,
	$13,
	$14,
	$15,
	$16,
	$17,
	nullif($18, ''),
	nullif($19, ''),
	nullif($20, ''),
	$21,
	$22
)
`, runID, row.JobID, row.SiteID, row.RequestConfigID, row.Status, row.AvailabilityResult, row.VerifyResult, row.EffectiveAccessScope, row.DerivedAccessScope, row.DerivedStatus, row.CheckMode, row.ContentValidationStatus, contentPayloadBytes, probeSummaryBytes, row.ResponseTimeMS, row.DurationMS, row.JitterMS, limitVarchar(row.FinalURL, 512), limitVarchar(row.ErrorCode, 64), row.ErrorMessage, row.StartedTime, row.FinishedTime)
	if err != nil {
		return fmt.Errorf("insert site check run: %w", err)
	}

	return nil
}

func (s *Store) InsertRSSFetchRun(ctx context.Context, row RSSFetchRunRow) error {
	runID, err := newUUIDV7String()
	if err != nil {
		return fmt.Errorf("generate rss fetch run id: %w", err)
	}

	summaryBytes, err := json.Marshal(row.SummaryPayload)
	if err != nil {
		return fmt.Errorf("marshal rss fetch summary: %w", err)
	}

	_, err = s.pool.Exec(ctx, `
insert into rss_fetch_runs (
	id,
	job_id,
	site_id,
	request_config_id,
	status,
	feed_url,
	feed_format,
	source_kind,
	effective_access_scope,
	network_path,
	fallback_used,
	article_count,
	upserted_count,
	skipped_count,
	error_code,
	error_message,
	summary_payload,
	started_time,
	finished_time
)
values (
	$1,
	$2,
	$3,
	nullif($4, '')::uuid,
	$5::run_record_status_enum,
	nullif($6, ''),
	$7::rss_feed_format_enum,
	nullif($8, '')::rss_fetch_source_kind_enum,
	nullif($9, '')::site_access_scope_enum,
	nullif($10, '')::rss_fetch_network_path_enum,
	$11,
	$12,
	$13,
	$14,
	nullif($15, ''),
	nullif($16, ''),
	$17,
	$18,
	$19
)
`, runID, row.JobID, row.SiteID, row.RequestConfigID, row.Status, limitVarchar(row.FeedURL, 512), row.FeedFormat, limitVarchar(row.SourceKind, 64), row.EffectiveAccessScope, row.NetworkPath, row.FallbackUsed, row.ArticleCount, row.UpsertedCount, row.SkippedCount, limitVarchar(row.ErrorCode, 64), row.ErrorMessage, summaryBytes, row.StartedTime, row.FinishedTime)
	if err != nil {
		return fmt.Errorf("insert rss fetch run: %w", err)
	}

	return nil
}
