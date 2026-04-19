import type {
  RSSFetchRunRecord,
  SiteCheckRunRecord,
  TaskJobDetailRecord,
  UpstreamSyncRunRecord,
} from './task-management.types';
import { formatDateTime, readObject, readString } from './task-management.types';

const LABEL_MAP: Record<string, string> = {
  task: '任务',
  source_count: '上游源总数',
  succeeded_count: '成功数',
  failed_count: '失败数',
  processed_count: '已处理',
  total_count: '总数',
  success_count: '成功数',
  failure_count: '失败数',
  skipped_count: '跳过数',
  site_name: '站点名称',
  site_id: '站点 ID',
  feed_mode: 'Feed 模式',
  feed_url: 'Feed URL',
  feed_urls: 'Feed URL 列表',
  source: '来源',
  action: '动作',
  adapter_key: '适配器',
  base_url: '基础地址',
  source_key: '上游源标识',
  skipped_reason: '跳过原因',
  article_urls: '文章 URL',
  source_kind: '抓取网络',
  page_title: '页面标题',
};

const PROBE_REGIONS = ['CN', 'GLOBAL'] as const;

export type TaskDetailEntry = { label: string; value: string };

export type TaskProgressSummary = {
  title: string;
  processedLabel: string;
  pendingLabel: string;
  total: number;
  processed: number;
  pending: number;
  failed: number;
  skipped: number;
  ratio: number;
};

export type TaskProbeEntry = {
  id: string;
  label: string;
  status: string;
  statusClass: string;
  fields: TaskDetailEntry[];
};

function humanizeKey(key: string): string {
  return (
    LABEL_MAP[key] ??
    key
      .split('_')
      .filter(Boolean)
      .map((item) => item[0]?.toUpperCase() + item.slice(1))
      .join(' ')
  );
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim() || '—';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return formatDateTime(value.toISOString());
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => formatValue(item)).filter((item) => item !== '—');
    return items.length > 0 ? items.join('，') : '—';
  }
  return '—';
}

function readMetric(
  value: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number,
): number {
  const candidate = value?.[key];
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallback;
}

function countRSSSkipped(runs: RSSFetchRunRecord[]): number {
  return runs.reduce((total, item) => total + (item.status === 'SKIPPED' ? 1 : 0), 0);
}
function buildResultClass(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (['SUCCESS', 'SUCCEEDED', 'PASSED', 'OK'].includes(normalized)) {
    return 'text-(--color-ok)';
  }
  if (['PENDING', 'RUNNING'].includes(normalized)) {
    return 'text-(--color-info)';
  }
  if (['SKIPPED', 'NOT_REQUESTED', 'CANCELED'].includes(normalized)) {
    return 'text-(--color-warn)';
  }
  return 'text-(--color-fail)';
}

function formatProbeLabel(region: string): string {
  return region === 'CN' ? '国内探测' : region === 'GLOBAL' ? '国外探测' : region;
}

export function formatRSSSourceKindLabel(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase() ?? '';
  if (normalized === 'CN' || normalized === 'LOCAL') {
    return 'CN';
  }
  if (
    normalized === 'GLOBAL' ||
    normalized === 'CLOUDFLARE' ||
    normalized === 'CLOUDFLARE_FALLBACK'
  ) {
    return 'GLOBAL';
  }
  return normalized || '—';
}

function readRSSNetworkRegion(run: RSSFetchRunRecord): string {
  const summaryRegion = readString(run.summary_payload.network_region);
  return formatRSSSourceKindLabel(summaryRegion || run.source_kind);
}

export function buildOverviewEntries(job: TaskJobDetailRecord): TaskDetailEntry[] {
  return [
    { label: '任务类型', value: job.task_type },
    { label: '状态', value: job.status },
    { label: '触发来源', value: job.trigger_source },
    { label: '任务 ID', value: job.id },
    { label: '调度 ID', value: job.schedule_id ?? '—' },
    { label: '重试根任务', value: job.retry_root_job_id ?? job.id },
    { label: '上级重试任务', value: job.retry_parent_job_id ?? '—' },
    { label: '重试序号', value: String(job.retry_sequence ?? 0) },
    { label: '创建时间', value: formatDateTime(job.created_time) },
    { label: '开始时间', value: formatDateTime(job.started_time) },
    { label: '完成时间', value: formatDateTime(job.finished_time) },
    { label: '错误代码', value: job.error_code ?? '—' },
    { label: '错误信息', value: job.error_message ?? '—' },
  ];
}

export function buildResultEntries(job: TaskJobDetailRecord): TaskDetailEntry[] {
  return Object.entries(job.result ?? {})
    .filter(([key]) => key !== 'failure_samples')
    .map(([key, value]) => ({ label: humanizeKey(key), value: formatValue(value) }))
    .filter((item) => item.value !== '—');
}

export function buildTaskProgress(job: TaskJobDetailRecord): TaskProgressSummary | null {
  const result = job.result ?? null;

  if (job.task_type === 'SITE_CHECK') {
    const total = readMetric(result, 'total_count', job.site_check_runs?.length ?? 0);
    const processed = readMetric(result, 'processed_count', job.site_check_runs?.length ?? 0);
    const failed = readMetric(
      result,
      'failure_count',
      job.site_check_runs?.filter((item) => item.status === 'FAILED').length ?? 0,
    );
    const skipped = readMetric(result, 'skipped_count', 0);
    return buildProgressSummary(
      '站点检测进度',
      '已检测',
      '未检测',
      total,
      processed,
      failed,
      skipped,
    );
  }

  if (job.task_type === 'RSS_FETCH') {
    const total = readMetric(result, 'total_count', job.rss_fetch_runs?.length ?? 0);
    const processed = readMetric(result, 'processed_count', job.rss_fetch_runs?.length ?? 0);
    const failed = readMetric(
      result,
      'failure_count',
      job.rss_fetch_runs?.filter((item) => item.status === 'FAILED').length ?? 0,
    );
    const skipped = readMetric(result, 'skipped_count', countRSSSkipped(job.rss_fetch_runs ?? []));
    return buildProgressSummary(
      'RSS 抓取进度',
      '已抓取',
      '未抓取',
      total,
      processed,
      failed,
      skipped,
    );
  }

  return null;
}

function buildProgressSummary(
  title: string,
  processedLabel: string,
  pendingLabel: string,
  total: number,
  processed: number,
  failed: number,
  skipped: number,
): TaskProgressSummary {
  const safeTotal = Math.max(total, 0);
  const safeProcessed = Math.min(Math.max(processed, 0), safeTotal || processed);
  const pending = Math.max(safeTotal - safeProcessed, 0);
  const ratio = safeTotal > 0 ? Math.min(100, Math.round((safeProcessed / safeTotal) * 100)) : 0;
  return {
    title,
    processedLabel,
    pendingLabel,
    total: safeTotal,
    processed: safeProcessed,
    pending,
    failed,
    skipped,
    ratio,
  };
}

export function buildSiteCheckSummaryEntries(run: SiteCheckRunRecord): TaskDetailEntry[] {
  return [
    { label: '站点 ID', value: run.site_id },
    { label: '运行状态', value: run.status },
    { label: '可用性', value: run.availability_result },
    { label: '复核结果', value: run.verify_result },
    { label: '执行地域', value: run.effective_access_scope ?? '—' },
    { label: '归并地域', value: run.derived_access_scope ?? '—' },
    { label: '归并状态', value: run.derived_status ?? '—' },
    { label: '检测模式', value: run.check_mode ?? '—' },
    { label: '内容校验', value: run.content_validation_status ?? '—' },
    {
      label: '响应耗时',
      value: run.response_time_ms !== null ? `${run.response_time_ms} ms` : '—',
    },
    { label: '执行耗时', value: run.duration_ms !== null ? `${run.duration_ms} ms` : '—' },
    { label: '最终地址', value: run.final_url ?? '—' },
    { label: '开始时间', value: formatDateTime(run.started_time) },
    { label: '完成时间', value: formatDateTime(run.finished_time) },
  ];
}

export function buildRSSFetchSummaryEntries(run: RSSFetchRunRecord): TaskDetailEntry[] {
  return [
    { label: '站点 ID', value: run.site_id },
    { label: '运行状态', value: run.status },
    { label: 'Feed 格式', value: run.feed_format || '—' },
    { label: '执行地域', value: run.effective_access_scope ?? '—' },
    { label: '抓取网络', value: readRSSNetworkRegion(run) },
    { label: '抓取路径', value: run.network_path ?? '—' },
    { label: '是否回退', value: run.fallback_used ? '是' : '否' },
    { label: '文章数', value: String(run.article_count) },
    { label: '入库数', value: String(run.upserted_count) },
    { label: '跳过数', value: String(run.skipped_count) },
    { label: 'Feed URL', value: run.feed_url ?? '—' },
  ];
}

export function buildUpstreamSyncSummaryEntries(run: UpstreamSyncRunRecord): TaskDetailEntry[] {
  return [
    { label: '上游源 ID', value: run.source_id },
    { label: '新增站点', value: String(run.new_site_count) },
    { label: '更新站点', value: String(run.updated_site_count) },
    { label: '跳过站点', value: String(run.skipped_count) },
    { label: '执行耗时', value: run.duration_ms !== null ? `${run.duration_ms} ms` : '—' },
    { label: '错误代码', value: run.error_code ?? '—' },
    { label: '错误信息', value: run.error_message ?? '—' },
  ];
}

export function buildPayloadEntries(payload: Record<string, unknown>): TaskDetailEntry[] {
  return Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => ({ label: humanizeKey(key), value: formatValue(value) }))
    .filter((item) => item.value !== '—');
}

export function buildProbeEntries(run: SiteCheckRunRecord): TaskProbeEntry[] {
  const probeMap = new Map<string, Record<string, unknown>>();
  for (const probe of run.probe_summary) {
    const row = readObject(probe);
    const region = readString(row.region).toUpperCase();
    if (region) {
      probeMap.set(region, row);
    }
  }

  return PROBE_REGIONS.map((region, index) => {
    const row = probeMap.get(region) ?? {};
    const result = readString(row.result) || 'SKIPPED';
    return {
      id: `${run.id}-${region}-${index}`,
      label: formatProbeLabel(region),
      status: result,
      statusClass: buildResultClass(result),
      fields: [
        { label: '状态码', value: formatValue(row.status_code) },
        {
          label: '响应耗时',
          value: typeof row.response_time_ms === 'number' ? `${row.response_time_ms} ms` : '—',
        },
        {
          label: '执行耗时',
          value: typeof row.duration_ms === 'number' ? `${row.duration_ms} ms` : '—',
        },
        { label: '最终地址', value: formatValue(row.final_url) },
        {
          label: '内容校验',
          value:
            row.content_verified === true
              ? '通过'
              : row.content_verified === false
                ? '未通过'
                : '—',
        },
        { label: '页面标题', value: formatValue(row.page_title) },
        { label: '返回信息', value: formatValue(row.message) },
      ],
    };
  });
}

export function buildRunResultClass(value: string): string {
  return buildResultClass(value);
}

export function buildNetworkClass(value: string | null | undefined): string {
  const label = formatRSSSourceKindLabel(value);
  return label === 'GLOBAL'
    ? 'text-(--color-info)'
    : label === 'CN'
      ? 'text-(--color-ok)'
      : 'text-(--color-fg-3)';
}

export const readRSSNetworkRegionLabel = (run: RSSFetchRunRecord): string =>
  readRSSNetworkRegion(run);

export const buildSiteCheckStatusOptions = (runs: SiteCheckRunRecord[]): string[] =>
  Array.from(new Set(runs.map((item) => item.availability_result).filter(Boolean))).sort();

export const buildRunStatusOptions = (runs: Array<{ status: string }>): string[] =>
  Array.from(new Set(runs.map((item) => item.status).filter(Boolean))).sort();
