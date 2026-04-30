import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { v7 } from 'uuid';

export const MAIN_TAGS = ['生活', '技术', '知识', '整合', '采集', '综合', ''] as const;

export const FROM_SOURCES = [
  'CIB',
  'BoYouQuan',
  'BlogFinder',
  'BKZ',
  'Travellings',
  'WebSubmit',
  'AdminAdd',
  'LinkPageSearch',
  'OldData',
] as const;

export const STATUS_TYPES = ['OK', 'ERROR', 'SSLERROR'] as const;

export const mainTagsEnum = pgEnum('main_tag_enum', MAIN_TAGS);
export const fromSources = pgEnum('from_enum', FROM_SOURCES);
export const statusTypes = pgEnum('status_enum', STATUS_TYPES);

export interface mutiFeed {
  name: string;
  url: string;
}

export const Blogs = pgTable(
  'blogs',
  {
    id: uuid()
      .$default(() => v7())
      .primaryKey(),
    bid: integer().unique(),
    name: varchar({ length: 32 }).unique().notNull(),
    url: varchar({ length: 64 }).unique().notNull(),
    sign: text().default(''),
    main_tag: mainTagsEnum(),
    sub_tag: jsonb().$type<string[]>().default([]),
    feed: jsonb().$type<mutiFeed[]>().default([]),
    from: fromSources().array(),
    sitemap: varchar({ length: 128 }),
    link_page: varchar({ length: 128 }),
    arch: varchar({ length: 32 }),
    join_time: timestamp({ withTimezone: true, precision: 6 }).$default(() => new Date()),
    update_time: timestamp({ withTimezone: true, precision: 6 }).$default(() => new Date()),
    status: statusTypes().default('OK'),
    passed: boolean(),
    recommen: boolean().default(false),
    access_count: integer().default(0),
    reason: text(),
    // TODO: saveweb_id: varchar({ length: 256 }),
  },
  (table) => [
    uniqueIndex('id_index').on(table.id),
    uniqueIndex('bid_index').on(table.bid),
    uniqueIndex('name_index').on(table.name),
    uniqueIndex('url_index').on(table.url),
    index('main_tag_index').on(table.main_tag),
    index('sub_tag_index').on(table.sub_tag),
  ],
);
