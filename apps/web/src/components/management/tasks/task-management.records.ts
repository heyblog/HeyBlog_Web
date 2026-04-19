import type {
  RSSFetchRunRecord,
  SiteCheckRunRecord,
  TaskJobDetailRecord,
  TaskJobRecord,
  TaskRequestConfigRecord,
  TaskScheduleRecord,
  UpstreamSyncRunRecord,
} from './task-management.types';
import { readObject, readString } from './task-management.types';

export const readScheduleRecord = (value: unknown): TaskScheduleRecord | null => {
  const row = readObject(value);
  const id = readString(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    name: readString(row.name),
    task_type: readString(row.task_type),
    schedule_mode: readString(row.schedule_mode),
    request_config_id: readString(row.request_config_id) || null,
    is_enabled: row.is_enabled !== false,
    schedule_config: readObject(row.schedule_config),
    payload_template: readObject(row.payload_template),
    next_run_time: readString(row.next_run_time) || null,
    last_run_time: readString(row.last_run_time) || null,
    created_time: readString(row.created_time) || undefined,
    updated_time: readString(row.updated_time) || undefined,
  };
};

export const readRequestConfigRecord = (value: unknown): TaskRequestConfigRecord | null => {
  const row = readObject(value);
  const id = readString(row.id);
  if (!id) {
    return null;
  }

  const defaultHeaders = readObject(row.default_headers);
  return {
    id,
    name: readString(row.name),
    task_type: readString(row.task_type),
    user_agent: readString(row.user_agent),
    timeout_ms: typeof row.timeout_ms === 'number' ? row.timeout_ms : 0,
    retry_max: typeof row.retry_max === 'number' ? row.retry_max : 0,
    retry_strategy: readString(row.retry_strategy),
    retry_base_delay_ms: typeof row.retry_base_delay_ms === 'number' ? row.retry_base_delay_ms : 0,
    retry_max_delay_ms: typeof row.retry_max_delay_ms === 'number' ? row.retry_max_delay_ms : 0,
    backoff_factor: typeof row.backoff_factor === 'number' ? row.backoff_factor : 0,
    jitter_ratio: typeof row.jitter_ratio === 'number' ? row.jitter_ratio : 0,
    wait_between_requests_ms:
      typeof row.wait_between_requests_ms === 'number' ? row.wait_between_requests_ms : 0,
    follow_redirects: row.follow_redirects !== false,
    default_headers: Object.fromEntries(
      Object.entries(defaultHeaders).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    ),
    is_enabled: row.is_enabled !== false,
    created_time: readString(row.created_time),
    updated_time: readString(row.updated_time),
  };
};

export const readJobRecord = (value: unknown): TaskJobRecord | null => {
  const row = readObject(value);
  const id = readString(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    schedule_id: readString(row.schedule_id) || null,
    task_type: readString(row.task_type),
    trigger_source: readString(row.trigger_source),
    status: readString(row.status),
    payload: readObject(row.payload),
    result: row.result ? readObject(row.result) : null,
    retry_root_job_id: readString(row.retry_root_job_id) || null,
    retry_parent_job_id: readString(row.retry_parent_job_id) || null,
    retry_sequence: typeof row.retry_sequence === 'number' ? row.retry_sequence : 0,
    run_at: readString(row.run_at) || null,
    locked_at: readString(row.locked_at) || null,
    locked_by: readString(row.locked_by) || null,
    heartbeat_time: readString(row.heartbeat_time) || null,
    error_code: readString(row.error_code) || null,
    error_message: readString(row.error_message) || null,
    created_time: readString(row.created_time),
    updated_time: readString(row.updated_time) || undefined,
    started_time: readString(row.started_time) || null,
    finished_time: readString(row.finished_time) || null,
  };
};

export const readSiteCheckRunRecord = (value: unknown): SiteCheckRunRecord | null => {
  const row = readObject(value);
  const id = readString(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    site_id: readString(row.site_id),
    status: readString(row.status),
    availability_result: readString(row.availability_result),
    verify_result: readString(row.verify_result),
    effective_access_scope: readString(row.effective_access_scope) || null,
    derived_access_scope: readString(row.derived_access_scope) || null,
    derived_status: readString(row.derived_status) || null,
    check_mode: readString(row.check_mode) || null,
    content_validation_status: readString(row.content_validation_status) || null,
    content_validation_payload: readObject(row.content_validation_payload),
    probe_summary: Array.isArray(row.probe_summary)
      ? row.probe_summary.map((item) => readObject(item))
      : [],
    response_time_ms: typeof row.response_time_ms === 'number' ? row.response_time_ms : null,
    duration_ms: typeof row.duration_ms === 'number' ? row.duration_ms : null,
    jitter_ms: typeof row.jitter_ms === 'number' ? row.jitter_ms : null,
    final_url: readString(row.final_url) || null,
    error_code: readString(row.error_code) || null,
    error_message: readString(row.error_message) || null,
    started_time: readString(row.started_time),
    finished_time: readString(row.finished_time) || null,
    created_time: readString(row.created_time),
  };
};

export const readRSSFetchRunRecord = (value: unknown): RSSFetchRunRecord | null => {
  const row = readObject(value);
  const id = readString(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    site_id: readString(row.site_id),
    status: readString(row.status),
    feed_url: readString(row.feed_url) || null,
    feed_format: readString(row.feed_format),
    source_kind: readString(row.source_kind) || null,
    effective_access_scope: readString(row.effective_access_scope) || null,
    network_path: readString(row.network_path) || null,
    fallback_used: row.fallback_used === true,
    article_count: typeof row.article_count === 'number' ? row.article_count : 0,
    upserted_count: typeof row.upserted_count === 'number' ? row.upserted_count : 0,
    skipped_count: typeof row.skipped_count === 'number' ? row.skipped_count : 0,
    error_code: readString(row.error_code) || null,
    error_message: readString(row.error_message) || null,
    summary_payload: readObject(row.summary_payload),
    started_time: readString(row.started_time),
    finished_time: readString(row.finished_time) || null,
    created_time: readString(row.created_time),
  };
};

export const readUpstreamSyncRunRecord = (value: unknown): UpstreamSyncRunRecord | null => {
  const row = readObject(value);
  const id = readString(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    source_id: readString(row.source_id),
    new_site_count: typeof row.new_site_count === 'number' ? row.new_site_count : 0,
    updated_site_count: typeof row.updated_site_count === 'number' ? row.updated_site_count : 0,
    skipped_count: typeof row.skipped_count === 'number' ? row.skipped_count : 0,
    duration_ms: typeof row.duration_ms === 'number' ? row.duration_ms : null,
    error_code: readString(row.error_code) || null,
    error_message: readString(row.error_message) || null,
    summary_payload: readObject(row.summary_payload),
    started_time: readString(row.started_time),
    finished_time: readString(row.finished_time) || null,
    created_time: readString(row.created_time),
  };
};

export const readJobDetailRecord = (value: unknown): TaskJobDetailRecord | null => {
  const job = readJobRecord(value);
  if (!job) {
    return null;
  }

  const row = readObject(value);
  return {
    ...job,
    retry_chain: Array.isArray(row.retry_chain)
      ? row.retry_chain.map(readJobRecord).filter((item): item is TaskJobRecord => item !== null)
      : [],
    site_check_runs: Array.isArray(row.site_check_runs)
      ? row.site_check_runs
          .map(readSiteCheckRunRecord)
          .filter((item): item is SiteCheckRunRecord => item !== null)
      : [],
    rss_fetch_runs: Array.isArray(row.rss_fetch_runs)
      ? row.rss_fetch_runs
          .map(readRSSFetchRunRecord)
          .filter((item): item is RSSFetchRunRecord => item !== null)
      : [],
    upstream_sync_runs: Array.isArray(row.upstream_sync_runs)
      ? row.upstream_sync_runs
          .map(readUpstreamSyncRunRecord)
          .filter((item): item is UpstreamSyncRunRecord => item !== null)
      : [],
  };
};

export const sanitizeTaskReturnTo = (value: string | null | undefined): string => {
  const normalized = value?.trim() ?? '';
  if (!normalized.startsWith('/management/tasks')) {
    return '/management/tasks';
  }

  return normalized;
};
