import {
  JOB_STATUS_KEYS,
  Jobs,
  type JobStatusKey,
  RSSFetchRuns,
  SCHEDULE_MODE_KEYS,
  type ScheduleModeKey,
  SiteCheckRuns,
  TASK_TYPE_KEYS,
  TaskSchedules,
  type TaskTypeKey,
  UpstreamSyncRuns,
} from '@zhblogs/db';

import { asc, desc, eq, or } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';

import { sendManagementError } from './management-route.shared';

export type TaskOverviewQuery = {
  status?: string;
  task_type?: string;
  trigger_source?: string;
  site_id?: string;
  created_from?: string;
  created_to?: string;
  limit?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeUuid(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeTaskLimit(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.max(10, Math.min(200, Math.floor(parsed)));
}

export function parseDateValue(value: string | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isTaskTypeKey(value: string): value is TaskTypeKey {
  return TASK_TYPE_KEYS.includes(value as TaskTypeKey);
}

export function isJobStatusKey(value: string): value is JobStatusKey {
  return JOB_STATUS_KEYS.includes(value as JobStatusKey);
}

export function isScheduleModeKey(value: string): value is ScheduleModeKey {
  return SCHEDULE_MODE_KEYS.includes(value as ScheduleModeKey);
}

export function serializeSchedule(row: typeof TaskSchedules.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    task_type: row.task_type,
    schedule_mode: row.schedule_mode,
    request_config_id: row.request_config_id ?? null,
    is_enabled: row.is_enabled,
    schedule_config: row.schedule_config ?? {},
    payload_template: row.payload_template ?? {},
    next_run_time: row.next_run_time?.toISOString() ?? null,
    last_run_time: row.last_run_time?.toISOString() ?? null,
    created_time: row.created_time.toISOString(),
    updated_time: row.updated_time.toISOString(),
  };
}

export function serializeJob(row: typeof Jobs.$inferSelect) {
  return {
    id: row.id,
    schedule_id: row.schedule_id ?? null,
    task_type: row.task_type,
    trigger_source: row.trigger_source,
    status: row.status,
    payload: row.payload ?? {},
    result: row.result ?? null,
    retry_root_job_id: row.retry_root_job_id ?? null,
    retry_parent_job_id: row.retry_parent_job_id ?? null,
    retry_sequence: row.retry_sequence,
    run_at: row.run_at.toISOString(),
    locked_at: row.locked_at?.toISOString() ?? null,
    locked_by: row.locked_by ?? null,
    heartbeat_time: row.heartbeat_time?.toISOString() ?? null,
    started_time: row.started_time?.toISOString() ?? null,
    finished_time: row.finished_time?.toISOString() ?? null,
    error_code: row.error_code ?? null,
    error_message: row.error_message ?? null,
    created_time: row.created_time.toISOString(),
    updated_time: row.updated_time.toISOString(),
  };
}

export function buildSiteTaskPayload(siteID: string, options: Record<string, unknown>) {
  return {
    target: {
      kind: 'SITE',
      site_id: siteID,
    },
    options,
  };
}

export async function loadRunsByJobID(app: FastifyInstance, job: typeof Jobs.$inferSelect) {
  if (job.task_type === 'SITE_CHECK') {
    const rows = await app.db.read
      .select()
      .from(SiteCheckRuns)
      .where(eq(SiteCheckRuns.job_id, job.id))
      .orderBy(desc(SiteCheckRuns.started_time));

    return {
      site_check_runs: rows.map((item) => ({
        ...item,
        started_time: item.started_time.toISOString(),
        finished_time: item.finished_time?.toISOString() ?? null,
        created_time: item.created_time.toISOString(),
      })),
    };
  }

  if (job.task_type === 'RSS_FETCH') {
    const rows = await app.db.read
      .select()
      .from(RSSFetchRuns)
      .where(eq(RSSFetchRuns.job_id, job.id))
      .orderBy(desc(RSSFetchRuns.started_time));

    return {
      rss_fetch_runs: rows.map((item) => ({
        ...item,
        started_time: item.started_time.toISOString(),
        finished_time: item.finished_time?.toISOString() ?? null,
        created_time: item.created_time.toISOString(),
      })),
    };
  }

  const rows = await app.db.read
    .select()
    .from(UpstreamSyncRuns)
    .where(eq(UpstreamSyncRuns.job_id, job.id))
    .orderBy(desc(UpstreamSyncRuns.started_time));

  return {
    upstream_sync_runs: rows.map((item) => ({
      ...item,
      started_time: item.started_time.toISOString(),
      finished_time: item.finished_time?.toISOString() ?? null,
      created_time: item.created_time.toISOString(),
    })),
  };
}

export async function loadRetryChainByJob(app: FastifyInstance, job: typeof Jobs.$inferSelect) {
  const rootJobID = job.retry_root_job_id ?? job.id;
  const rows = await app.db.read
    .select()
    .from(Jobs)
    .where(or(eq(Jobs.id, rootJobID), eq(Jobs.retry_root_job_id, rootJobID)))
    .orderBy(asc(Jobs.retry_sequence), asc(Jobs.created_time));

  return {
    retry_chain: rows.map(serializeJob),
  };
}

export async function loadScheduleByID(app: FastifyInstance, scheduleID: string) {
  const [schedule] = await app.db.read
    .select()
    .from(TaskSchedules)
    .where(eq(TaskSchedules.id, scheduleID))
    .limit(1);

  return schedule ?? null;
}

export function sendTaskError(reply: FastifyReply, error: unknown) {
  if (!(error instanceof Error)) {
    return sendManagementError(reply, 500, 'TASK_OPERATION_FAILED', 'Task operation failed.');
  }

  const [code, message] = error.message.split(':', 2);
  if (code && message) {
    const statusCode = code.endsWith('_NOT_FOUND') ? 404 : code.includes('INVALID') ? 422 : 400;
    return sendManagementError(reply, statusCode, code, message);
  }

  return sendManagementError(reply, 500, 'TASK_OPERATION_FAILED', error.message);
}
