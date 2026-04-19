export type SectionKey = 'schedules' | 'requestConfigs' | 'manual' | 'jobs';

export type CatalogItem = {
  key: string;
  label: string;
  description?: string;
};

export type ManualPreset = {
  id: string;
  name: string;
  task_type: string;
  payload_template: Record<string, unknown>;
};

export type TaskCatalog = {
  task_types: CatalogItem[];
  schedule_modes: CatalogItem[];
  trigger_sources: CatalogItem[];
  job_statuses: CatalogItem[];
  request_target_kinds: CatalogItem[];
  request_retry_strategies: CatalogItem[];
  rss_feed_modes: CatalogItem[];
  presets: {
    manual: ManualPreset[];
  };
};

export type TaskRequestConfigRecord = {
  id: string;
  name: string;
  task_type: string;
  user_agent: string;
  timeout_ms: number;
  retry_max: number;
  retry_strategy: string;
  retry_base_delay_ms: number;
  retry_max_delay_ms: number;
  backoff_factor: number;
  jitter_ratio: number;
  wait_between_requests_ms: number;
  follow_redirects: boolean;
  default_headers: Record<string, string>;
  is_enabled: boolean;
  created_time: string;
  updated_time: string;
};

export type TaskScheduleRecord = {
  id: string;
  name: string;
  task_type: string;
  schedule_mode: string;
  request_config_id: string | null;
  is_enabled: boolean;
  schedule_config: Record<string, unknown>;
  payload_template: Record<string, unknown>;
  next_run_time: string | null;
  last_run_time: string | null;
  created_time?: string;
  updated_time?: string;
};

export type TaskJobRecord = {
  id: string;
  schedule_id?: string | null;
  task_type: string;
  trigger_source: string;
  status: string;
  payload: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  retry_root_job_id?: string | null;
  retry_parent_job_id?: string | null;
  retry_sequence?: number;
  run_at?: string | null;
  locked_at?: string | null;
  locked_by?: string | null;
  heartbeat_time?: string | null;
  error_code?: string | null;
  error_message: string | null;
  created_time: string;
  updated_time?: string;
  started_time?: string | null;
  finished_time?: string | null;
};

export type SiteCheckRunRecord = {
  id: string;
  site_id: string;
  status: string;
  availability_result: string;
  verify_result: string;
  effective_access_scope: string | null;
  derived_access_scope: string | null;
  derived_status: string | null;
  check_mode: string | null;
  content_validation_status: string | null;
  content_validation_payload: Record<string, unknown>;
  probe_summary: Array<Record<string, unknown>>;
  response_time_ms: number | null;
  duration_ms: number | null;
  jitter_ms: number | null;
  final_url: string | null;
  error_code: string | null;
  error_message: string | null;
  started_time: string;
  finished_time: string | null;
  created_time: string;
};

export type RSSFetchRunRecord = {
  id: string;
  site_id: string;
  status: string;
  feed_url: string | null;
  feed_format: string;
  source_kind: string | null;
  effective_access_scope: string | null;
  network_path: string | null;
  fallback_used: boolean;
  article_count: number;
  upserted_count: number;
  skipped_count: number;
  error_code: string | null;
  error_message: string | null;
  summary_payload: Record<string, unknown>;
  started_time: string;
  finished_time: string | null;
  created_time: string;
};

export type UpstreamSyncRunRecord = {
  id: string;
  source_id: string;
  new_site_count: number;
  updated_site_count: number;
  skipped_count: number;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  summary_payload: Record<string, unknown>;
  started_time: string;
  finished_time: string | null;
  created_time: string;
};

export type TaskJobDetailRecord = TaskJobRecord & {
  retry_chain?: TaskJobRecord[];
  site_check_runs?: SiteCheckRunRecord[];
  rss_fetch_runs?: RSSFetchRunRecord[];
  upstream_sync_runs?: UpstreamSyncRunRecord[];
};

export type JobFilterState = {
  status: string;
  task_type: string;
  trigger_source: string;
  site_id: string;
  created_from: string;
  created_to: string;
};

export type HeaderRowState = {
  key: string;
  value: string;
};

export type ScheduleFormState = {
  id: string | null;
  name: string;
  taskType: string;
  scheduleMode: string;
  requestConfigId: string;
  isEnabled: boolean;
  timezone: string;
  cron: string;
  intervalSeconds: string;
  jitterSeconds: string;
  targetKind: string;
  targetSiteId: string;
  targetSiteIds: string;
  sourceId: string;
  feedMode: string;
  runContentValidation: boolean;
  runGlobalCheck: boolean;
  runFullCheck: boolean;
};

export type RequestConfigFormState = {
  id: string | null;
  name: string;
  taskType: string;
  userAgent: string;
  timeoutMs: string;
  retryMax: string;
  retryStrategy: string;
  retryBaseDelayMs: string;
  retryMaxDelayMs: string;
  backoffFactor: string;
  jitterRatio: string;
  waitBetweenRequestsMs: string;
  followRedirects: boolean;
  isEnabled: boolean;
  headerRows: HeaderRowState[];
};

export const FALLBACK_TIMEZONE = 'Asia/Shanghai';

export const STATUS_CLASS_MAP: Record<string, string> = {
  PENDING: 'text-[color:var(--color-info)]',
  RUNNING: 'text-[color:var(--color-info)]',
  SUCCEEDED: 'text-[color:var(--color-ok)]',
  FAILED: 'text-[color:var(--color-fail)]',
  CANCELED: 'text-[color:var(--color-warn)]',
  SKIPPED: 'text-[color:var(--color-warn)]',
  OK: 'text-[color:var(--color-ok)]',
  WARNING: 'text-[color:var(--color-warn)]',
  ERROR: 'text-[color:var(--color-fail)]',
};

export const TERMINAL_JOB_STATUS = new Set(['SUCCEEDED', 'FAILED', 'CANCELED']);
export const JOB_CANCEL_REQUESTED_CODE = 'CANCEL_REQUESTED';

export const isJobCancelRequested = (job: Pick<TaskJobRecord, 'status' | 'error_code'>): boolean =>
  job.status === 'RUNNING' && job.error_code === JOB_CANCEL_REQUESTED_CODE;

export const readString = (value: unknown): string => (typeof value === 'string' ? value : '');

export const readObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

export const readIntegerString = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return String(Math.trunc(parsed));
    }
  }

  return '';
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', { hour12: false });
};

export const buildStatusClass = (status: string): string =>
  STATUS_CLASS_MAP[status] || 'text-(--color-fg-2)';

export const formatCatalogOption = (item: CatalogItem): string => {
  const label = item.label?.trim();
  if (!label || label === item.key) {
    return item.key;
  }

  return `${label}（${item.key}）`;
};

export const normalizeSection = (value: string): SectionKey | null => {
  if (
    value === 'schedules' ||
    value === 'requestConfigs' ||
    value === 'manual' ||
    value === 'jobs'
  ) {
    return value;
  }

  return null;
};
