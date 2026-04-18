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

import type { SiteAccessScopeKey } from '../constants/site';
import type {
  RSSFeedFormatKey,
  RSSFetchNetworkPathKey,
  RSSFetchSourceKindKey,
  RunRecordStatusKey,
} from '../constants/task';

import {
  rssFeedFormatEnum,
  rssFetchNetworkPathEnum,
  rssFetchSourceKindEnum,
  runRecordStatusEnum,
  siteAccessScopeEnum,
} from './enums';
import { RequestConfigs } from './request-configs';
import { Sites } from './sites';
import { Jobs } from './tasks';

export interface RSSFetchRunSummary {
  site_id?: string;
  site_name?: string;
  feed_url?: string;
  feed_mode?: string;
  article_urls?: string[];
  skipped_reason?: string | null;
}

export const RSSFetchRuns = pgTable(
  'rss_fetch_runs',
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
    site_id: uuid()
      .notNull()
      .references(() => Sites.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    request_config_id: uuid().references(() => RequestConfigs.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    status: runRecordStatusEnum().$type<RunRecordStatusKey>().notNull(),
    effective_access_scope: siteAccessScopeEnum().$type<SiteAccessScopeKey>().notNull(),
    feed_url: varchar({ length: 512 }),
    feed_format: rssFeedFormatEnum().$type<RSSFeedFormatKey>().notNull().default('UNKNOWN'),
    source_kind: rssFetchSourceKindEnum().$type<RSSFetchSourceKindKey>(),
    network_path: rssFetchNetworkPathEnum().$type<RSSFetchNetworkPathKey>().notNull(),
    fallback_used: boolean().notNull().default(false),
    article_count: integer().notNull().default(0),
    upserted_count: integer().notNull().default(0),
    skipped_count: integer().notNull().default(0),
    error_code: varchar({ length: 64 }),
    error_message: text(),
    summary_payload: jsonb().$type<RSSFetchRunSummary>().notNull().default({}),
    started_time: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    finished_time: timestamp({ withTimezone: true, precision: 6 }),
    created_time: timestamp({ withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => [
    index('rss_fetch_runs_job_id_started_time_index').on(table.job_id, table.started_time.desc()),
    index('rss_fetch_runs_site_id_started_time_index').on(table.site_id, table.started_time.desc()),
    check('rss_fetch_runs_article_count_non_negative_check', sql`${table.article_count} >= 0`),
    check('rss_fetch_runs_upserted_count_non_negative_check', sql`${table.upserted_count} >= 0`),
    check('rss_fetch_runs_skipped_count_non_negative_check', sql`${table.skipped_count} >= 0`),
  ],
);
