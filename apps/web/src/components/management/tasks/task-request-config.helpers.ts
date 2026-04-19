import type {
  HeaderRowState,
  RequestConfigFormState,
  TaskRequestConfigRecord,
} from './task-management.types';

const createHeaderRow = (key = '', value = ''): HeaderRowState => ({ key, value });

export const createEmptyRequestConfigForm = (): RequestConfigFormState => ({
  id: null,
  name: '',
  taskType: 'SITE_CHECK',
  userAgent: '',
  timeoutMs: '20000',
  retryMax: '2',
  retryStrategy: 'EXPONENTIAL',
  retryBaseDelayMs: '1000',
  retryMaxDelayMs: '10000',
  backoffFactor: '2',
  jitterRatio: '0',
  waitBetweenRequestsMs: '0',
  followRedirects: true,
  isEnabled: true,
  headerRows: [createHeaderRow()],
});

export const buildRequestConfigForm = (
  record: TaskRequestConfigRecord | null | undefined,
): RequestConfigFormState => {
  if (!record) {
    return createEmptyRequestConfigForm();
  }

  const headerRows = Object.entries(record.default_headers).map(([key, value]) =>
    createHeaderRow(key, value),
  );

  return {
    id: record.id,
    name: record.name,
    taskType: record.task_type,
    userAgent: record.user_agent,
    timeoutMs: String(record.timeout_ms),
    retryMax: String(record.retry_max),
    retryStrategy: record.retry_strategy,
    retryBaseDelayMs: String(record.retry_base_delay_ms),
    retryMaxDelayMs: String(record.retry_max_delay_ms),
    backoffFactor: String(record.backoff_factor),
    jitterRatio: String(record.jitter_ratio),
    waitBetweenRequestsMs: String(record.wait_between_requests_ms),
    followRedirects: record.follow_redirects,
    isEnabled: record.is_enabled,
    headerRows: headerRows.length > 0 ? headerRows : [createHeaderRow()],
  };
};

const parseInteger = (value: string, fallback: number): number => {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const buildRequestConfigPayload = (
  form: RequestConfigFormState,
): Record<string, unknown> => ({
  ...(form.id ? { id: form.id } : {}),
  name: form.name.trim(),
  task_type: form.taskType,
  user_agent: form.userAgent.trim(),
  timeout_ms: parseInteger(form.timeoutMs, 20_000),
  retry_max: parseInteger(form.retryMax, 2),
  retry_strategy: form.retryStrategy,
  retry_base_delay_ms: parseInteger(form.retryBaseDelayMs, 1_000),
  retry_max_delay_ms: parseInteger(form.retryMaxDelayMs, 10_000),
  backoff_factor: parseInteger(form.backoffFactor, 2),
  jitter_ratio: parseInteger(form.jitterRatio, 0),
  wait_between_requests_ms: parseInteger(form.waitBetweenRequestsMs, 0),
  follow_redirects: form.followRedirects,
  is_enabled: form.isEnabled,
  default_headers: Object.fromEntries(
    form.headerRows
      .map((row) => [row.key.trim(), row.value.trim()] as const)
      .filter(([key, value]) => key && value),
  ),
});

export const appendHeaderRow = (rows: HeaderRowState[]): HeaderRowState[] => [
  ...rows,
  createHeaderRow(),
];

export const removeHeaderRow = (rows: HeaderRowState[], index: number): HeaderRowState[] => {
  const next = rows.filter((_, rowIndex) => rowIndex !== index);
  return next.length > 0 ? next : [createHeaderRow()];
};
