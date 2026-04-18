import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { v7 } from 'uuid';

import { RequestConfigs } from './request-configs';
import { Sites } from './sites';

export const UpstreamSources = pgTable(
  'upstream_sources',
  {
    id: uuid()
      .$default(() => v7())
      .primaryKey(),
    source_key: varchar({ length: 64 }).notNull().unique(),
    label: varchar({ length: 128 }).notNull(),
    base_url: varchar({ length: 512 }).notNull(),
    adapter_key: varchar({ length: 64 }).notNull(),
    request_config_id: uuid().references(() => RequestConfigs.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    is_enabled: boolean().notNull().default(true),
    remark: varchar({ length: 512 }),
    created_time: timestamp({ withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updated_time: timestamp({ withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('upstream_sources_enabled_index').on(table.is_enabled),
    check('upstream_sources_source_key_not_blank_check', sql`btrim(${table.source_key}) <> ''`),
    check('upstream_sources_label_not_blank_check', sql`btrim(${table.label}) <> ''`),
    check('upstream_sources_base_url_not_blank_check', sql`btrim(${table.base_url}) <> ''`),
    check('upstream_sources_adapter_key_not_blank_check', sql`btrim(${table.adapter_key}) <> ''`),
  ],
);

export const UpstreamSiteBindings = pgTable(
  'upstream_site_bindings',
  {
    id: uuid()
      .$default(() => v7())
      .primaryKey(),
    source_id: uuid()
      .notNull()
      .references(() => UpstreamSources.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    site_id: uuid()
      .notNull()
      .references(() => Sites.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    external_key: varchar({ length: 256 }).notNull(),
    external_url: varchar({ length: 512 }),
    last_seen_time: timestamp({ withTimezone: true, precision: 6 }).notNull().defaultNow(),
    created_time: timestamp({ withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updated_time: timestamp({ withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('upstream_site_bindings_source_site_index').on(table.source_id, table.site_id),
    index('upstream_site_bindings_source_external_key_index').on(
      table.source_id,
      table.external_key,
    ),
    check(
      'upstream_site_bindings_external_key_not_blank_check',
      sql`btrim(${table.external_key}) <> ''`,
    ),
  ],
);
