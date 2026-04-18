import { type Jobs } from '@zhblogs/db';

import type { FastifyInstance } from 'fastify';

import {
  loadRetryChainByJob,
  loadRunsByJobID,
  loadScheduleByID,
  serializeJob,
  serializeSchedule,
} from './management-task.shared';
import { buildSpreadsheetWorkbook, type SpreadsheetSheet } from './management-task-spreadsheet-xls';

type TaskJobRecord = ReturnType<typeof serializeJob>;
type TaskScheduleRecord = ReturnType<typeof serializeSchedule>;

type ExportData = {
  job: TaskJobRecord;
  schedule: TaskScheduleRecord | null;
  retryChain: TaskJobRecord[];
  siteCheckRuns: Array<Record<string, unknown>>;
  rssFetchRuns: Array<Record<string, unknown>>;
  upstreamSyncRuns: Array<Record<string, unknown>>;
};

function jsonText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return JSON.stringify(value);
}

function createSummarySheet(job: TaskJobRecord): SpreadsheetSheet {
  return {
    name: 'summary',
    columns: ['field', 'value'],
    rows: [
      { field: 'job_id', value: job.id },
      { field: 'schedule_id', value: job.schedule_id ?? '' },
      { field: 'task_type', value: job.task_type },
      { field: 'trigger_source', value: job.trigger_source },
      { field: 'status', value: job.status },
      { field: 'retry_root_job_id', value: job.retry_root_job_id ?? '' },
      { field: 'retry_parent_job_id', value: job.retry_parent_job_id ?? '' },
      { field: 'retry_sequence', value: job.retry_sequence ?? 0 },
      { field: 'run_at', value: job.run_at ?? '' },
      { field: 'locked_at', value: job.locked_at ?? '' },
      { field: 'locked_by', value: job.locked_by ?? '' },
      { field: 'heartbeat_time', value: job.heartbeat_time ?? '' },
      { field: 'started_time', value: job.started_time ?? '' },
      { field: 'finished_time', value: job.finished_time ?? '' },
      { field: 'error_code', value: job.error_code ?? '' },
      { field: 'error_message', value: job.error_message ?? '' },
      { field: 'created_time', value: job.created_time },
      { field: 'updated_time', value: job.updated_time ?? '' },
      { field: 'payload_json', value: jsonText(job.payload) },
      { field: 'result_json', value: jsonText(job.result) },
      { field: 'exported_at', value: new Date().toISOString() },
    ],
  };
}

function createScheduleSheet(schedule: TaskScheduleRecord | null): SpreadsheetSheet | null {
  if (!schedule) {
    return null;
  }

  return {
    name: 'schedule',
    columns: ['field', 'value'],
    rows: [
      { field: 'schedule_id', value: schedule.id },
      { field: 'name', value: schedule.name },
      { field: 'task_type', value: schedule.task_type },
      { field: 'schedule_mode', value: schedule.schedule_mode },
      { field: 'request_config_id', value: schedule.request_config_id ?? '' },
      { field: 'is_enabled', value: schedule.is_enabled },
      { field: 'next_run_time', value: schedule.next_run_time ?? '' },
      { field: 'last_run_time', value: schedule.last_run_time ?? '' },
      { field: 'created_time', value: schedule.created_time },
      { field: 'updated_time', value: schedule.updated_time },
      { field: 'schedule_config_json', value: jsonText(schedule.schedule_config) },
      { field: 'payload_template_json', value: jsonText(schedule.payload_template) },
    ],
  };
}

function mapRetryChainRow(item: TaskJobRecord) {
  return {
    id: item.id,
    task_type: item.task_type,
    trigger_source: item.trigger_source,
    status: item.status,
    retry_sequence: item.retry_sequence ?? 0,
    created_time: item.created_time,
    started_time: item.started_time ?? '',
    finished_time: item.finished_time ?? '',
    error_code: item.error_code ?? '',
    error_message: item.error_message ?? '',
    payload_json: jsonText(item.payload),
    result_json: jsonText(item.result),
  };
}

function createRetryChainSheet(items: TaskJobRecord[]): SpreadsheetSheet | null {
  if (items.length === 0) {
    return null;
  }

  return {
    name: 'retry_chain',
    rows: items.map(mapRetryChainRow),
  };
}

function mapSiteCheckRunRow(item: Record<string, unknown>) {
  return {
    id: item.id,
    site_id: item.site_id,
    status: item.status,
    availability_result: item.availability_result,
    verify_result: item.verify_result,
    effective_access_scope: item.effective_access_scope,
    derived_access_scope: item.derived_access_scope,
    derived_status: item.derived_status,
    check_mode: item.check_mode,
    content_validation_status: item.content_validation_status,
    response_time_ms: item.response_time_ms,
    duration_ms: item.duration_ms,
    jitter_ms: item.jitter_ms,
    final_url: item.final_url,
    error_code: item.error_code,
    error_message: item.error_message,
    started_time: item.started_time,
    finished_time: item.finished_time,
    created_time: item.created_time,
    content_validation_payload_json: jsonText(item.content_validation_payload),
    probe_summary_json: jsonText(item.probe_summary),
  };
}

function createSiteCheckRunSheet(items: Array<Record<string, unknown>>): SpreadsheetSheet | null {
  if (items.length === 0) {
    return null;
  }

  return {
    name: 'site_check_runs',
    rows: items.map(mapSiteCheckRunRow),
  };
}

function createSiteCheckProbeRows(items: Array<Record<string, unknown>>) {
  return items.flatMap((item) => {
    const probes = Array.isArray(item.probe_summary) ? item.probe_summary : [];

    return probes.map((probe, index) => {
      const current = probe && typeof probe === 'object' ? (probe as Record<string, unknown>) : {};

      return {
        run_id: item.id,
        probe_index: index + 1,
        region: current.region ?? '',
        result: current.result ?? '',
        status_code: current.status_code ?? '',
        response_time_ms: current.response_time_ms ?? '',
        duration_ms: current.duration_ms ?? '',
        final_url: current.final_url ?? '',
        content_verified: current.content_verified ?? '',
        message: current.message ?? '',
        payload_json: jsonText(current),
      };
    });
  });
}

function createSiteCheckProbeSheet(items: Array<Record<string, unknown>>): SpreadsheetSheet | null {
  const rows = createSiteCheckProbeRows(items);

  if (rows.length === 0) {
    return null;
  }

  return {
    name: 'site_check_probes',
    rows,
  };
}

function createValidationSheet(items: Array<Record<string, unknown>>): SpreadsheetSheet | null {
  const rows = items
    .filter(
      (item) =>
        item.content_validation_status !== 'NOT_REQUESTED' ||
        (item.content_validation_payload &&
          typeof item.content_validation_payload === 'object' &&
          Object.keys(item.content_validation_payload as Record<string, unknown>).length > 0),
    )
    .map((item) => ({
      run_id: item.id,
      site_id: item.site_id,
      content_validation_status: item.content_validation_status ?? '',
      payload_json: jsonText(item.content_validation_payload),
    }));

  return rows.length > 0 ? { name: 'content_validation', rows } : null;
}

function createRSSFetchRunSheet(items: Array<Record<string, unknown>>): SpreadsheetSheet | null {
  if (items.length === 0) {
    return null;
  }

  return {
    name: 'rss_fetch_runs',
    rows: items.map((item) => ({
      id: item.id,
      site_id: item.site_id,
      status: item.status,
      feed_url: item.feed_url,
      feed_format: item.feed_format,
      source_kind: item.source_kind,
      effective_access_scope: item.effective_access_scope,
      network_path: item.network_path,
      fallback_used: item.fallback_used,
      article_count: item.article_count,
      upserted_count: item.upserted_count,
      skipped_count: item.skipped_count,
      error_code: item.error_code,
      error_message: item.error_message,
      started_time: item.started_time,
      finished_time: item.finished_time,
      created_time: item.created_time,
      summary_payload_json: jsonText(item.summary_payload),
    })),
  };
}

function createUpstreamSyncRunSheet(
  items: Array<Record<string, unknown>>,
): SpreadsheetSheet | null {
  if (items.length === 0) {
    return null;
  }

  return {
    name: 'upstream_sync_runs',
    rows: items.map((item) => ({
      id: item.id,
      source_id: item.source_id,
      new_site_count: item.new_site_count,
      updated_site_count: item.updated_site_count,
      skipped_count: item.skipped_count,
      duration_ms: item.duration_ms,
      error_code: item.error_code,
      error_message: item.error_message,
      started_time: item.started_time,
      finished_time: item.finished_time,
      created_time: item.created_time,
      summary_payload_json: jsonText(item.summary_payload),
    })),
  };
}

async function loadExportData(
  app: FastifyInstance,
  job: typeof Jobs.$inferSelect,
): Promise<ExportData> {
  const [retryData, runData, schedule] = await Promise.all([
    loadRetryChainByJob(app, job),
    loadRunsByJobID(app, job),
    job.schedule_id ? loadScheduleByID(app, job.schedule_id) : Promise.resolve(null),
  ]);

  return {
    job: serializeJob(job),
    schedule: schedule ? serializeSchedule(schedule) : null,
    retryChain: retryData.retry_chain ?? [],
    siteCheckRuns: 'site_check_runs' in runData ? (runData.site_check_runs ?? []) : [],
    rssFetchRuns: 'rss_fetch_runs' in runData ? (runData.rss_fetch_runs ?? []) : [],
    upstreamSyncRuns: 'upstream_sync_runs' in runData ? (runData.upstream_sync_runs ?? []) : [],
  };
}

function compactSheets(sheets: Array<SpreadsheetSheet | null>): SpreadsheetSheet[] {
  return sheets.filter((sheet): sheet is SpreadsheetSheet => sheet !== null);
}

export async function buildTaskJobExportWorkbook(
  app: FastifyInstance,
  job: typeof Jobs.$inferSelect,
): Promise<Buffer> {
  const data = await loadExportData(app, job);

  return buildSpreadsheetWorkbook(
    compactSheets([
      createSummarySheet(data.job),
      createScheduleSheet(data.schedule),
      createRetryChainSheet(data.retryChain),
      createSiteCheckRunSheet(data.siteCheckRuns),
      createSiteCheckProbeSheet(data.siteCheckRuns),
      createValidationSheet(data.siteCheckRuns),
      createRSSFetchRunSheet(data.rssFetchRuns),
      createUpstreamSyncRunSheet(data.upstreamSyncRuns),
    ]),
  );
}
