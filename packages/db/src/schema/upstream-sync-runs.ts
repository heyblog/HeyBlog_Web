import { sql } from 'drizzle-orm';
import {
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

import { RequestConfigs } from './request-configs';
import { Jobs } from './tasks';
import { UpstreamSources } from './upstream-sources';

export interface UpstreamSyncRunSummary {
  processed_items?: number;
  new_sites?: string[];
  updated_sites?: string[];
  skipped_reasons?: string[];
}

export const UpstreamSyncRuns = pgTable(
  'upstream_sync_runs',
  {
    id: uuid()
      .$default(() => v7())
      .primaryKey(),
    job_id: uuid()
      .notNull()
      .references(() => Jobs.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    source_id: uuid()
      .notNull()
      .references(() => UpstreamSources.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    request_config_id: uuid().references(() => RequestConfigs.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    new_site_count: integer().notNull().default(0),
    updated_site_count: integer().notNull().default(0),
    skipped_count: integer().notNull().default(0),
    duration_ms: integer(),
    error_code: varchar({ length: 64 }),
    error_message: text(),
    summary_payload: jsonb().$type<UpstreamSyncRunSummary>().notNull().default({}),
    started_time: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    finished_time: timestamp({ withTimezone: true, precision: 6 }),
    created_time: timestamp({ withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => [
    index('upstream_sync_runs_job_id_started_time_index').on(
      table.job_id,
      table.started_time.desc(),
    ),
    index('upstream_sync_runs_source_id_started_time_index').on(
      table.source_id,
      table.started_time.desc(),
    ),
    check(
      'upstream_sync_runs_new_site_count_non_negative_check',
      sql`${table.new_site_count} >= 0`,
    ),
    check(
      'upstream_sync_runs_updated_site_count_non_negative_check',
      sql`${table.updated_site_count} >= 0`,
    ),
    check('upstream_sync_runs_skipped_count_non_negative_check', sql`${table.skipped_count} >= 0`),
    check(
      'upstream_sync_runs_duration_non_negative_check',
      sql`${table.duration_ms} is null or ${table.duration_ms} >= 0`,
    ),
  ],
);
