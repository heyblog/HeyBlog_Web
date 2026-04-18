import {
  JOB_TRIGGER_SOURCE_KEYS,
  REQUEST_TARGET_KIND_KEYS,
  RSS_FEED_MODE_KEYS,
  TASK_TYPE_KEYS,
} from '@zhblogs/db';

import { z } from 'zod';

const targetSchema = z.object({
  kind: z.enum(REQUEST_TARGET_KIND_KEYS),
  site_id: z.uuid().optional(),
  site_ids: z.array(z.uuid()).optional(),
});

export const enqueueItemSchema = z.object({
  schedule_id: z.uuid().optional(),
  task_type: z.enum(TASK_TYPE_KEYS),
  trigger_source: z.enum(JOB_TRIGGER_SOURCE_KEYS),
  payload: z.record(z.string(), z.unknown()),
  run_at: z.coerce.date().optional(),
  retry_root_job_id: z.uuid().optional(),
  retry_parent_job_id: z.uuid().optional(),
  retry_sequence: z.number().int().nonnegative().optional(),
});

export const taskTargetSchema = targetSchema;

export const siteTaskPayloadSchema = z.object({
  target: targetSchema,
  request_config_id: z.uuid().optional(),
  options: z
    .object({
      run_content_validation: z.boolean().optional(),
      run_global_check: z.boolean().optional(),
      source: z.string().trim().optional(),
      feed_mode: z.enum(RSS_FEED_MODE_KEYS).optional(),
    })
    .passthrough()
    .optional(),
});

export const batchSchema = z.object({
  items: z.array(enqueueItemSchema).min(1).max(200),
});
