import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { v7 } from 'uuid';

import type { RequestRetryStrategyKey, TaskTypeKey } from '../constants/task';

import { requestRetryStrategyEnum, taskTypeEnum } from './enums';

export interface RequestConfigHeaderMap {
  [headerName: string]: string;
}

export const RequestConfigs = pgTable(
  'request_configs',
  {
    id: uuid()
      .$default(() => v7())
      .primaryKey(),
    name: varchar({ length: 128 }).notNull(),
    task_type: taskTypeEnum().$type<TaskTypeKey>().notNull(),
    user_agent: varchar({ length: 512 }).notNull(),
    timeout_ms: integer().notNull().default(20_000),
    retry_max: integer().notNull().default(2),
    retry_strategy: requestRetryStrategyEnum().$type<RequestRetryStrategyKey>().notNull(),
    retry_base_delay_ms: integer().notNull().default(1_000),
    retry_max_delay_ms: integer().notNull().default(10_000),
    backoff_factor: integer().notNull().default(2),
    jitter_ratio: integer().notNull().default(0),
    wait_between_requests_ms: integer().notNull().default(0),
    default_headers: jsonb().$type<RequestConfigHeaderMap>().notNull().default({}),
    follow_redirects: boolean().notNull().default(true),
    is_enabled: boolean().notNull().default(true),
    created_time: timestamp({ withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updated_time: timestamp({ withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    check('request_configs_name_not_blank_check', sql`btrim(${table.name}) <> ''`),
    check('request_configs_user_agent_not_blank_check', sql`btrim(${table.user_agent}) <> ''`),
    check('request_configs_timeout_positive_check', sql`${table.timeout_ms} > 0`),
    check('request_configs_retry_max_non_negative_check', sql`${table.retry_max} >= 0`),
    check(
      'request_configs_retry_base_delay_non_negative_check',
      sql`${table.retry_base_delay_ms} >= 0`,
    ),
    check(
      'request_configs_retry_max_delay_non_negative_check',
      sql`${table.retry_max_delay_ms} >= 0`,
    ),
    check('request_configs_backoff_factor_positive_check', sql`${table.backoff_factor} > 0`),
    check('request_configs_jitter_ratio_non_negative_check', sql`${table.jitter_ratio} >= 0`),
    check(
      'request_configs_wait_between_requests_non_negative_check',
      sql`${table.wait_between_requests_ms} >= 0`,
    ),
  ],
);
