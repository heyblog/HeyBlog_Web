import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { v7 } from 'uuid';

import type { SiteStatusTypeKey } from '../constants/monitoring';
import type {
  FromSourceKey,
  SiteAccessScopeKey,
  SiteClassificationStatusKey,
} from '../constants/site';

import {
  articleFeedbackActionEnum,
  articleFeedbackReasonEnum,
  auditStatusEnum,
  siteAuditActionEnum,
  siteFeedbackReasonEnum,
} from './enums';
import { FeedArticles } from './feed-articles';
import type { MultiFeed } from './sites';
import { Sites } from './sites';
import { Users } from './users';

export interface SiteAuditArchitectureSnapshot {
  program_id?: string | null;
  program_name?: string | null;
  program_is_open_source?: boolean | null;
  stacks?: Array<{
    category: 'FRAMEWORK' | 'LANGUAGE';
    catalog_id?: string | null;
    name?: string | null;
    name_normalized?: string | null;
  }> | null;
  website_url?: string | null;
  repo_url?: string | null;
}

export interface SiteAuditTagSnapshot {
  tag_id?: string | null;
  name?: string | null;
  name_normalized?: string | null;
}

/** 站点审核快照，用于新增/修改/删除审核时展示前后差异 */
export interface SiteAuditSnapshot {
  bid?: string | null;
  name?: string | null;
  url?: string | null;
  sign?: string | null;
  icon_base64?: string | null;
  feed?: MultiFeed[] | null;
  from?: FromSourceKey[] | null;
  classification_status?: SiteClassificationStatusKey | null;
  sitemap?: string | null;
  link_page?: string | null;
  access_scope?: SiteAccessScopeKey | null;
  status?: SiteStatusTypeKey | null;
  is_show?: boolean | null;
  recommend?: boolean | null;
  reason?: string | null;
  main_tag?: SiteAuditTagSnapshot | null;
  sub_tags?: SiteAuditTagSnapshot[] | null;
  architecture?: SiteAuditArchitectureSnapshot | null;
}

/** 前端 diff 视图可直接消费的字段差异 */
export interface SiteAuditDiffItem {
  field: string;
  before: unknown;
  after: unknown;
}

/** 站点信息审核表，覆盖新增、修改申请、删除申请 */
export const SiteAudits = pgTable(
  'site_audits',
  {
    /** 审核记录主键 */
    id: uuid()
      .$default(() => v7())
      .primaryKey(),
    /** 关联站点，新增审核时允许为空 */
    site_id: uuid().references(() => Sites.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    /** 审核动作类型 */
    action: siteAuditActionEnum().notNull(),
    /** 审核流转状态 */
    status: auditStatusEnum().notNull().default('PENDING'),
    /** 当前站点快照，供修改/删除时对比 */
    current_snapshot: jsonb().$type<SiteAuditSnapshot>(),
    /** 申请提交后的目标快照，删除审核时可为空 */
    proposed_snapshot: jsonb().$type<SiteAuditSnapshot>(),
    /** 预计算的字段差异，方便前端直接展示 */
    diff: jsonb().$type<SiteAuditDiffItem[]>().notNull().default([]),
    /** 审核员人工修正后最终生效的快照 */
    review_override_snapshot: jsonb().$type<SiteAuditSnapshot>(),
    /** 审核员人工修正相对提交内容的差异 */
    review_override_diff: jsonb().$type<SiteAuditDiffItem[]>(),
    /** 提交申请原因 */
    submit_reason: text(),
    /** 审核备注 */
    reviewer_comment: text(),
    /** 执行审核的管理员用户 */
    reviewed_by: uuid().references(() => Users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    /** 申请人信息 */
    submitter_name: varchar({ length: 64 }),
    submitter_email: varchar({ length: 128 }),
    /** 是否同意后续通过邮件接收审核结果通知 */
    notify_by_email: boolean().notNull().default(false),
    /** 审核完成时间 */
    reviewed_time: timestamp({ withTimezone: true, precision: 6 }),
    /** 申请创建时间 */
    created_time: timestamp({ withTimezone: true, precision: 6 }).notNull().defaultNow(),
    /** 审核记录最后更新时间 */
    updated_time: timestamp({ withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('site_audits_site_id_created_time_index').on(table.site_id, table.created_time.desc()),
    index('site_audits_status_created_time_index').on(table.status, table.created_time.desc()),
    index('site_audits_action_status_index').on(table.action, table.status),
    index('site_audits_reviewed_by_index').on(table.reviewed_by),
    check('site_audits_submitter_name_not_blank_check', sql`btrim(${table.submitter_name}) <> ''`),
    check(
      'site_audits_submitter_email_not_blank_check',
      sql`btrim(${table.submitter_email}) <> ''`,
    ),
  ],
);

/** RSS 文章问题反馈审核表，用于隐藏或删除抓取文章 */
export const ArticleFeedbackAudits = pgTable(
  'article_feedback_audits',
  {
    /** 反馈审核主键 */
    id: uuid()
      .$default(() => v7())
      .primaryKey(),
    /** 被反馈的文章 */
    article_id: uuid()
      .notNull()
      .references(() => FeedArticles.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    /** 文章所属站点，方便后台按站点筛选 */
    site_id: uuid()
      .notNull()
      .references(() => Sites.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    /** 用户希望执行的文章处理动作 */
    action: articleFeedbackActionEnum().notNull(),
    /** 反馈问题分类 */
    reason_type: articleFeedbackReasonEnum().notNull().default('OTHER'),
    /** 反馈审核状态 */
    status: auditStatusEnum().notNull().default('PENDING'),
    /** 用户反馈内容 */
    feedback_content: text().notNull(),
    /** 反馈人信息 */
    reporter_name: varchar({ length: 64 }),
    reporter_email: varchar({ length: 128 }),
    /** 用户是否声明将通过邮件补充附件 */
    has_attachment: boolean().notNull().default(false),
    /** 审核备注 */
    reviewer_comment: text(),
    /** 执行审核的管理员用户 */
    reviewed_by: uuid().references(() => Users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    /** 审核完成时间 */
    reviewed_time: timestamp({ withTimezone: true, precision: 6 }),
    /** 反馈创建时间 */
    created_time: timestamp({ withTimezone: true, precision: 6 }).notNull().defaultNow(),
    /** 反馈记录最后更新时间 */
    updated_time: timestamp({ withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('article_feedback_audits_article_id_created_time_index').on(
      table.article_id,
      table.created_time.desc(),
    ),
    index('article_feedback_audits_site_id_status_index').on(table.site_id, table.status),
    index('article_feedback_audits_status_created_time_index').on(
      table.status,
      table.created_time.desc(),
    ),
    index('article_feedback_audits_action_status_index').on(table.action, table.status),
    index('article_feedback_audits_reviewed_by_index').on(table.reviewed_by),
    check(
      'article_feedback_audits_reporter_name_not_blank_check',
      sql`btrim(${table.reporter_name}) <> ''`,
    ),
    check(
      'article_feedback_audits_reporter_email_not_blank_check',
      sql`btrim(${table.reporter_email}) <> ''`,
    ),
  ],
);

/** 站点问题反馈审核表，与站点信息修改审核流分离 */
export const SiteFeedbackAudits = pgTable(
  'site_feedback_audits',
  {
    id: uuid()
      .$default(() => v7())
      .primaryKey(),
    site_id: uuid()
      .notNull()
      .references(() => Sites.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    reason_type: siteFeedbackReasonEnum().notNull().default('OTHER'),
    status: auditStatusEnum().notNull().default('PENDING'),
    feedback_content: text().notNull(),
    reporter_name: varchar({ length: 64 }),
    reporter_email: varchar({ length: 128 }),
    notify_by_email: boolean().notNull().default(false),
    reviewer_comment: text(),
    reviewed_by: uuid().references(() => Users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    reviewed_time: timestamp({ withTimezone: true, precision: 6 }),
    created_time: timestamp({ withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updated_time: timestamp({ withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('site_feedback_audits_site_id_created_time_index').on(
      table.site_id,
      table.created_time.desc(),
    ),
    index('site_feedback_audits_status_created_time_index').on(
      table.status,
      table.created_time.desc(),
    ),
    index('site_feedback_audits_reason_status_index').on(table.reason_type, table.status),
    index('site_feedback_audits_reviewed_by_index').on(table.reviewed_by),
    check(
      'site_feedback_audits_reporter_name_not_blank_check',
      sql`btrim(${table.reporter_name}) <> ''`,
    ),
    check(
      'site_feedback_audits_reporter_email_not_blank_check',
      sql`btrim(${table.reporter_email}) <> ''`,
    ),
  ],
);
