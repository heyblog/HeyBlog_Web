import { Jobs, type TASK_TYPE_KEYS } from '@zhblogs/db';

import { inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TaskTypeValue = (typeof TASK_TYPE_KEYS)[number];

export interface EnqueueJobInput {
  schedule_id?: string;
  task_type: TaskTypeValue;
  trigger_source: 'SCHEDULE' | 'MANUAL' | 'EVENT';
  payload: Record<string, unknown>;
  run_at?: Date;
  retry_root_job_id?: string;
  retry_parent_job_id?: string;
  retry_sequence?: number;
}

export interface EnqueueJobResult {
  job_id: string;
  status: string;
  trigger_source: string;
}

type InsertedJobRow = {
  id: string;
  status: string;
  trigger_source: string;
};

function normalizeNullableString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function validateTaskTarget(payload: Record<string, unknown>): string | null {
  const target = readRecord(payload.target);
  const kind = normalizeNullableString(target.kind);

  if (!kind || !['SITE', 'SITE_LIST', 'ALL_VISIBLE'].includes(kind)) {
    return 'target.kind must be SITE, SITE_LIST or ALL_VISIBLE.';
  }

  if (kind === 'SITE' && !isValidUuid(target.site_id)) {
    return 'target.site_id must be a valid UUID.';
  }

  if (kind === 'SITE_LIST') {
    const siteIDs = Array.isArray(target.site_ids) ? target.site_ids : [];
    if (siteIDs.length === 0 || siteIDs.some((item) => !isValidUuid(item))) {
      return 'target.site_ids must contain valid UUID values.';
    }
  }

  return null;
}

export function validateTaskPayload(
  taskType: TaskTypeValue,
  payload: Record<string, unknown>,
): string | null {
  if (taskType === 'UPSTREAM_SYNC') {
    const sourceID = payload.source_id;
    if (sourceID !== undefined && !isValidUuid(sourceID)) {
      return 'source_id must be a valid UUID.';
    }

    const requestConfigID = payload.request_config_id;
    if (requestConfigID !== undefined && !isValidUuid(requestConfigID)) {
      return 'request_config_id must be a valid UUID.';
    }

    return null;
  }

  const targetError = validateTaskTarget(payload);
  if (targetError) {
    return targetError;
  }

  const requestConfigID = payload.request_config_id;
  if (requestConfigID !== undefined && !isValidUuid(requestConfigID)) {
    return 'request_config_id must be a valid UUID.';
  }

  if (taskType === 'RSS_FETCH') {
    const options = readRecord(payload.options);
    const feedMode = normalizeNullableString(options.feed_mode);
    if (feedMode && !['DEFAULT_ONLY', 'ALL'].includes(feedMode)) {
      return 'options.feed_mode must be DEFAULT_ONLY or ALL.';
    }
  }

  return null;
}

async function insertJobRow(
  app: FastifyInstance,
  input: EnqueueJobInput,
  runAt: Date,
): Promise<InsertedJobRow> {
  const [row] = await app.db.write
    .insert(Jobs)
    .values({
      schedule_id: normalizeNullableString(input.schedule_id),
      task_type: input.task_type,
      trigger_source: input.trigger_source,
      status: 'PENDING',
      payload: input.payload,
      retry_root_job_id: normalizeNullableString(input.retry_root_job_id),
      retry_parent_job_id: normalizeNullableString(input.retry_parent_job_id),
      retry_sequence: input.retry_sequence ?? 0,
      run_at: runAt,
      result: {},
    })
    .returning({
      id: Jobs.id,
      status: Jobs.status,
      trigger_source: Jobs.trigger_source,
    });

  if (!row) {
    throw new Error('JOB_INSERT_FAILED:job insert returned no row');
  }

  return row;
}

export async function enqueueJob(
  app: FastifyInstance,
  input: EnqueueJobInput,
): Promise<EnqueueJobResult> {
  const payloadError = validateTaskPayload(input.task_type, input.payload);
  if (payloadError) {
    throw new Error(`PAYLOAD_VIOLATION:${payloadError}`);
  }

  const runAt = input.run_at ?? new Date();
  const row = await insertJobRow(app, input, runAt);

  return {
    job_id: row.id,
    status: row.status,
    trigger_source: row.trigger_source,
  };
}

export async function enqueueJobs(
  app: FastifyInstance,
  inputs: EnqueueJobInput[],
): Promise<{ created: EnqueueJobResult[]; failed: Array<{ index: number; error: string }> }> {
  const created: EnqueueJobResult[] = [];
  const failed: Array<{ index: number; error: string }> = [];

  for (const [index, input] of inputs.entries()) {
    try {
      created.push(await enqueueJob(app, input));
    } catch (error) {
      failed.push({
        index,
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      });
    }
  }

  return { created, failed };
}

export async function requeueJobs(
  app: FastifyInstance,
  jobIDs: string[],
  allowedStatuses: string[],
): Promise<{ retried_count: number }> {
  if (jobIDs.length === 0) {
    return { retried_count: 0 };
  }

  const sourceJobs = await app.db.read
    .select({
      id: Jobs.id,
      schedule_id: Jobs.schedule_id,
      task_type: Jobs.task_type,
      status: Jobs.status,
      payload: Jobs.payload,
      retry_root_job_id: Jobs.retry_root_job_id,
      retry_sequence: Jobs.retry_sequence,
    })
    .from(Jobs)
    .where(inArray(Jobs.id, jobIDs));

  const eligibleJobs = sourceJobs.filter((item) => allowedStatuses.includes(item.status));
  let retriedCount = 0;

  for (const item of eligibleJobs) {
    await enqueueJob(app, {
      schedule_id: item.schedule_id ?? undefined,
      task_type: item.task_type,
      trigger_source: 'MANUAL',
      payload: (item.payload ?? {}) as Record<string, unknown>,
      retry_root_job_id: item.retry_root_job_id ?? item.id,
      retry_parent_job_id: item.id,
      retry_sequence: (item.retry_sequence ?? 0) + 1,
    });
    retriedCount += 1;
  }

  return { retried_count: retriedCount };
}
