import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { v7 } from 'uuid';

import type {
  JobStatusKey,
  JobTriggerSourceKey,
  RequestTargetKindKey,
  RSSFeedModeKey,
  ScheduleModeKey,
  TaskTypeKey,
} from '../constants/task';

import {
  jobStatusEnum,
  jobTriggerSourceEnum,
  requestTargetKindEnum,
  rssFeedModeEnum,
  scheduleModeEnum,
  taskTypeEnum,
} from './enums';
import { RequestConfigs } from './request-configs';

export interface TaskScheduleConfig {
  cron?: string;
  interval_seconds?: number;
  timezone?: string;
  jitter_seconds?: number;
  start_at?: string;
  end_at?: string;
}

export interface TaskTarget {
  kind: RequestTargetKindKey;
  site_id?: string;
  site_ids?: string[];
}

export interface UpstreamSyncPayload {
  source_id?: string;
  request_config_id?: string;
  options?: Record<string, unknown>;
}

export interface SiteCheckTaskOptions {
  run_content_validation?: boolean;
  run_global_check?: boolean;
  run_full_check?: boolean;
  source?: string;
}

export interface SiteCheckPayload {
  target?: TaskTarget;
  request_config_id?: string;
  options?: SiteCheckTaskOptions & Record<string, unknown>;
}

export interface RSSFetchTaskOptions {
  feed_mode?: RSSFeedModeKey;
  source?: string;
  feed_urls?: string[];
}

export interface RSSFetchPayload {
  target?: TaskTarget;
  request_config_id?: string;
  options?: RSSFetchTaskOptions & Record<string, unknown>;
}

export interface TaskPayloadTemplate {
  source_id?: string;
  target?: TaskTarget;
  request_config_id?: string;
  options?: Record<string, unknown>;
}

export const TaskSchedules = pgTable(
  'task_schedules',
  {
    id: uuid()
      .$default(() => v7())
      .primaryKey(),
    name: varchar({ length: 128 }).notNull(),
    task_type: taskTypeEnum().$type<TaskTypeKey>().notNull(),
    schedule_mode: scheduleModeEnum().$type<ScheduleModeKey>().notNull(),
    request_config_id: uuid().references(() => RequestConfigs.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    is_enabled: boolean().notNull().default(true),
    schedule_config: jsonb().$type<TaskScheduleConfig>().notNull().default({}),
    payload_template: jsonb().$type<TaskPayloadTemplate>().notNull().default({}),
    next_run_time: timestamp({ withTimezone: true, precision: 6 }),
    last_run_time: timestamp({ withTimezone: true, precision: 6 }),
    created_time: timestamp({ withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updated_time: timestamp({ withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('task_schedules_task_type_enabled_index').on(table.task_type, table.is_enabled),
    index('task_schedules_enabled_next_run_index').on(table.is_enabled, table.next_run_time),
    check('task_schedules_name_not_blank_check', sql`btrim(${table.name}) <> ''`),
  ],
);

export const Jobs = pgTable(
  'jobs',
  {
    id: uuid()
      .$default(() => v7())
      .primaryKey(),
    schedule_id: uuid().references(() => TaskSchedules.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    task_type: taskTypeEnum().$type<TaskTypeKey>().notNull(),
    trigger_source: jobTriggerSourceEnum().$type<JobTriggerSourceKey>().notNull(),
    status: jobStatusEnum().$type<JobStatusKey>().notNull().default('PENDING'),
    payload: jsonb()
      .$type<UpstreamSyncPayload | SiteCheckPayload | RSSFetchPayload | Record<string, unknown>>()
      .notNull()
      .default({}),
    result: jsonb().$type<Record<string, unknown>>(),
    retry_root_job_id: uuid(),
    retry_parent_job_id: uuid(),
    retry_sequence: integer().notNull().default(0),
    run_at: timestamp({ withTimezone: true, precision: 6 }).notNull().defaultNow(),
    locked_at: timestamp({ withTimezone: true, precision: 6 }),
    locked_by: varchar({ length: 128 }),
    heartbeat_time: timestamp({ withTimezone: true, precision: 6 }),
    started_time: timestamp({ withTimezone: true, precision: 6 }),
    finished_time: timestamp({ withTimezone: true, precision: 6 }),
    error_code: varchar({ length: 64 }),
    error_message: text(),
    created_time: timestamp({ withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updated_time: timestamp({ withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('jobs_status_run_at_index').on(table.status, table.run_at),
    index('jobs_schedule_created_time_index').on(table.schedule_id, table.created_time.desc()),
    index('jobs_task_type_created_time_index').on(table.task_type, table.created_time.desc()),
    index('jobs_locked_by_heartbeat_time_index').on(table.locked_by, table.heartbeat_time),
    index('jobs_retry_root_created_time_index').on(
      table.retry_root_job_id,
      table.created_time.desc(),
    ),
    check('jobs_retry_sequence_non_negative_check', sql`${table.retry_sequence} >= 0`),
  ],
);

export const taskTargetKind = requestTargetKindEnum;
export const rssFeedMode = rssFeedModeEnum;
