package store

import (
	"context"
	"fmt"
)

func (s *Store) LoadSiteCheckResumeRecords(
	ctx context.Context,
	jobID string,
) ([]SiteCheckResumeRecord, error) {
	rows, err := s.pool.Query(ctx, `
select distinct on (site_id)
	site_id,
	status::text,
	coalesce(derived_status::text, ''),
	coalesce(error_message, '')
from site_check_runs
where job_id = $1
order by site_id, created_time desc
`, jobID)
	if err != nil {
		return nil, fmt.Errorf("load site check resume records: %w", err)
	}
	defer rows.Close()

	return scanResumeRecords(rows, func() (SiteCheckResumeRecord, error) {
		var record SiteCheckResumeRecord
		err := rows.Scan(&record.SiteID, &record.Status, &record.DerivedStatus, &record.ErrorMessage)
		return record, err
	}, "site check")
}

func (s *Store) LoadRSSFetchResumeRecords(
	ctx context.Context,
	jobID string,
) ([]RSSFetchResumeRecord, error) {
	rows, err := s.pool.Query(ctx, `
select distinct on (site_id)
	site_id,
	status::text,
	coalesce(feed_url, ''),
	coalesce(error_message, '')
from rss_fetch_runs
where job_id = $1
order by site_id, created_time desc
`, jobID)
	if err != nil {
		return nil, fmt.Errorf("load rss fetch resume records: %w", err)
	}
	defer rows.Close()

	return scanResumeRecords(rows, func() (RSSFetchResumeRecord, error) {
		var record RSSFetchResumeRecord
		err := rows.Scan(&record.SiteID, &record.Status, &record.FeedURL, &record.ErrorMessage)
		return record, err
	}, "rss fetch")
}

func (s *Store) LoadUpstreamSyncResumeRecords(
	ctx context.Context,
	jobID string,
) ([]UpstreamSyncResumeRecord, error) {
	rows, err := s.pool.Query(ctx, `
select distinct on (source_id)
	source_id,
	coalesce(error_code, ''),
	coalesce(error_message, '')
from upstream_sync_runs
where job_id = $1
order by source_id, created_time desc
`, jobID)
	if err != nil {
		return nil, fmt.Errorf("load upstream sync resume records: %w", err)
	}
	defer rows.Close()

	return scanResumeRecords(rows, func() (UpstreamSyncResumeRecord, error) {
		var record UpstreamSyncResumeRecord
		err := rows.Scan(&record.SourceID, &record.ErrorCode, &record.ErrorMessage)
		return record, err
	}, "upstream sync")
}

func scanResumeRecords[T any](
	rows interface {
		Next() bool
		Err() error
	},
	scan func() (T, error),
	label string,
) ([]T, error) {
	records := make([]T, 0, 32)
	for rows.Next() {
		record, err := scan()
		if err != nil {
			return nil, fmt.Errorf("scan %s resume record: %w", label, err)
		}
		records = append(records, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate %s resume records: %w", label, err)
	}

	return records, nil
}
