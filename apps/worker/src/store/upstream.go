package store

import (
	"context"
	"encoding/json"
	"fmt"
)

func (s *Store) LoadEnabledUpstreamSources(ctx context.Context) ([]UpstreamSourceRecord, error) {
	rows, err := s.pool.Query(ctx, `
select
	id,
	source_key,
	label,
	base_url,
	adapter_key,
	coalesce(request_config_id::text, '')
from upstream_sources
where is_enabled = true
order by source_key asc
`)
	if err != nil {
		return nil, fmt.Errorf("load upstream sources: %w", err)
	}
	defer rows.Close()

	result := make([]UpstreamSourceRecord, 0, 16)
	for rows.Next() {
		var item UpstreamSourceRecord
		if scanErr := rows.Scan(
			&item.ID,
			&item.SourceKey,
			&item.Label,
			&item.BaseURL,
			&item.AdapterKey,
			&item.RequestConfigID,
		); scanErr != nil {
			return nil, fmt.Errorf("scan upstream source: %w", scanErr)
		}
		result = append(result, item)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate upstream sources: %w", err)
	}

	return result, nil
}

func (s *Store) InsertUpstreamSyncRun(ctx context.Context, row UpstreamSyncRunRow) error {
	runID, err := newUUIDV7String()
	if err != nil {
		return fmt.Errorf("generate upstream sync run id: %w", err)
	}

	summaryBytes, err := json.Marshal(row.SummaryPayload)
	if err != nil {
		return fmt.Errorf("marshal upstream sync summary: %w", err)
	}

	_, err = s.pool.Exec(ctx, `
insert into upstream_sync_runs (
	id,
	job_id,
	source_id,
	request_config_id,
	new_site_count,
	updated_site_count,
	skipped_count,
	duration_ms,
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
	$5,
	$6,
	$7,
	$8,
	nullif($9, ''),
	nullif($10, ''),
	$11,
	$12,
	$13
)
`, runID, row.JobID, row.SourceID, row.RequestConfigID, row.NewSiteCount, row.UpdatedSiteCount, row.SkippedCount, row.DurationMS, limitVarchar(row.ErrorCode, 64), row.ErrorMessage, summaryBytes, row.StartedTime, row.FinishedTime)
	if err != nil {
		return fmt.Errorf("insert upstream sync run: %w", err)
	}

	return nil
}
