import {
  type AuditStatusKey,
  FEED_TYPES,
  FROM_SOURCES,
  SITE_ACCESS_SCOPES,
  SITE_CLASSIFICATION_STATUSES,
  SITE_STATUS_TYPES,
  type SiteAuditActionKey,
  type SiteAuditDiffItem,
  SiteAudits,
  type SiteAuditSnapshot,
} from '@zhblogs/db';

import { and, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, preHandlerHookHandler } from 'fastify';

import { buildSnapshotDiff } from '@/domain/sites/service/site-snapshot.service';
import { normalizePagination } from '@/presentation/management/routes/management-route.shared';

type ParseResult<T> = { success: true; data: T } | { success: false };

type SafeParser<T> = {
  safeParse: (input: unknown) => ParseResult<T>;
};

type ErrorResponder = (
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  fields?: string[],
) => unknown;

type ReadRoutesDeps = {
  requireAdminReviewer: preHandlerHookHandler;
  errorResponseSchema: unknown;
  auditListResultSchema: unknown;
  auditDetailResultSchema: unknown;
  auditIdParamJsonSchema: unknown;
  auditListQuerySchema: SafeParser<{
    status?: string;
    action?: string;
    page?: number;
    pageSize?: number;
  }>;
  siteIdParamSchema: SafeParser<{ site_id: string | null }>;
  sendApiError: ErrorResponder;
  resolveAuditSiteName: (
    proposed: SiteAuditSnapshot | null | undefined,
    current: SiteAuditSnapshot | null | undefined,
  ) => string | null;
};

const SITE_AUDIT_FIELD_LABELS: Record<string, string> = {
  name: '站点名称',
  url: '站点地址',
  sign: '站点简介',
  icon_base64: '站点图标',
  feed: '订阅地址',
  classification_status: '分类状态',
  sitemap: '网站地图',
  link_page: '友链页面',
  main_tag: '主分类',
  sub_tags: '子分类',
  architecture: '程序与技术栈',
  bid: '站点 BID',
  from: '来源渠道',
  access_scope: '访问范围',
  status: '站点状态',
  is_show: '前台显示',
  recommend: '推荐站点',
  reason: '备注原因',
};

const CONTENT_SNAPSHOT_FIELD_ORDER: Array<keyof SiteAuditSnapshot> = [
  'name',
  'url',
  'sign',
  'feed',
  'sitemap',
  'link_page',
  'main_tag',
  'sub_tags',
  'architecture',
];

const SITE_BRIEF_FIELD_ORDER: Array<keyof SiteAuditSnapshot> = [
  'name',
  'url',
  'sign',
  'main_tag',
  'sub_tags',
];

const readOptionLabel = (
  options: Record<string, { label: string }>,
  value: string | null | undefined,
): string => {
  if (!value) {
    return '—';
  }

  return options[value]?.label ?? value;
};

const formatTagDisplay = (value: SiteAuditSnapshot['main_tag']): string => {
  if (!value) {
    return '—';
  }

  return value.name?.trim() || value.tag_id?.trim() || '—';
};

const formatSubTagsDisplay = (value: SiteAuditSnapshot['sub_tags']): string => {
  if (!value || value.length === 0) {
    return '—';
  }

  return value.map((item) => item.name?.trim() || item.tag_id?.trim() || '未命名标签').join(' / ');
};

const formatFeedDisplay = (value: SiteAuditSnapshot['feed']): string => {
  if (!value || value.length === 0) {
    return '—';
  }

  return value
    .map((item, index) => {
      const parts = [
        item.isDefault ? '默认订阅' : `订阅 ${index + 1}`,
        item.name?.trim() || '未命名',
        item.url?.trim() || '—',
      ];
      const typeLabel = item.type ? readOptionLabel(FEED_TYPES, item.type) : null;

      if (typeLabel && typeLabel !== '—') {
        parts.push(typeLabel);
      }

      return parts.join(' · ');
    })
    .join('\n');
};

const formatArchitectureDisplay = (value: SiteAuditSnapshot['architecture']): string => {
  if (!value) {
    return '—';
  }

  const stacks =
    value.stacks?.map((item) => item.name?.trim() || item.catalog_id?.trim() || '未命名技术栈') ??
    [];
  const lines = [
    `程序：${value.program_name?.trim() || value.program_id?.trim() || '—'}`,
    `开源：${
      value.program_is_open_source === true
        ? '是'
        : value.program_is_open_source === false
          ? '否'
          : '—'
    }`,
    `技术栈：${stacks.length > 0 ? stacks.join(' / ') : '—'}`,
    `官网：${value.website_url?.trim() || '—'}`,
    `仓库：${value.repo_url?.trim() || '—'}`,
  ];

  return lines.join('\n');
};

const formatAuditValueDisplay = (
  field: keyof SiteAuditSnapshot | string,
  value: unknown,
): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (field === 'feed') {
    return formatFeedDisplay(value as SiteAuditSnapshot['feed']);
  }

  if (field === 'main_tag') {
    return formatTagDisplay(value as SiteAuditSnapshot['main_tag']);
  }

  if (field === 'sub_tags') {
    return formatSubTagsDisplay(value as SiteAuditSnapshot['sub_tags']);
  }

  if (field === 'architecture') {
    return formatArchitectureDisplay(value as SiteAuditSnapshot['architecture']);
  }

  if (field === 'from' && Array.isArray(value)) {
    return value.length > 0
      ? value
          .map((item) => readOptionLabel(FROM_SOURCES, typeof item === 'string' ? item : null))
          .join(' / ')
      : '—';
  }

  if (field === 'classification_status') {
    return readOptionLabel(SITE_CLASSIFICATION_STATUSES, typeof value === 'string' ? value : null);
  }

  if (field === 'access_scope') {
    return readOptionLabel(SITE_ACCESS_SCOPES, typeof value === 'string' ? value : null);
  }

  if (field === 'status') {
    return readOptionLabel(SITE_STATUS_TYPES, typeof value === 'string' ? value : null);
  }

  if (field === 'is_show') {
    return typeof value === 'boolean' ? (value ? '显示' : '隐藏') : '—';
  }

  if (field === 'recommend') {
    return typeof value === 'boolean' ? (value ? '推荐' : '不推荐') : '—';
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.map((item) => String(item)).join(' / ') : '—';
  }

  return String(value);
};

const buildSnapshotFieldViews = (
  snapshot: SiteAuditSnapshot | null | undefined,
  fields: Array<keyof SiteAuditSnapshot> = CONTENT_SNAPSHOT_FIELD_ORDER,
): Array<{ field: string; label: string; value_display: string }> => {
  if (!snapshot) {
    return [];
  }

  return fields
    .filter((field) => snapshot[field] !== undefined)
    .map((field) => ({
      field,
      label: SITE_AUDIT_FIELD_LABELS[field] ?? field,
      value_display: formatAuditValueDisplay(field, snapshot[field]),
    }));
};

const buildDiffViews = (
  diff: SiteAuditDiffItem[] | null | undefined,
  fields: Array<keyof SiteAuditSnapshot> = CONTENT_SNAPSHOT_FIELD_ORDER,
): Array<{
  field: string;
  label: string;
  before_display: string;
  after_display: string;
}> =>
  (diff ?? [])
    .filter((item) => fields.includes(item.field as keyof SiteAuditSnapshot))
    .map((item) => ({
      field: item.field,
      label: SITE_AUDIT_FIELD_LABELS[item.field] ?? item.field,
      before_display: formatAuditValueDisplay(item.field, item.before),
      after_display: formatAuditValueDisplay(item.field, item.after),
    }));

export function registerAdminAuditReadRoutes(app: FastifyInstance, deps: ReadRoutesDeps): void {
  app.get(
    '/api/management/site-audits',
    {
      preHandler: deps.requireAdminReviewer,
      schema: {
        tags: ['sites'],
        summary: 'List site submission audits for admin review',
        response: {
          200: deps.auditListResultSchema,
          400: deps.errorResponseSchema,
        },
      },
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = deps.auditListQuerySchema.safeParse(request.query);

      if (!parsed.success) {
        return deps.sendApiError(
          reply,
          400,
          'INVALID_QUERY',
          'Request query is invalid for audit listing.',
        );
      }

      const conditions = [];

      if (parsed.data.status) {
        conditions.push(eq(SiteAudits.status, parsed.data.status as AuditStatusKey));
      }

      if (parsed.data.action) {
        conditions.push(eq(SiteAudits.action, parsed.data.action as SiteAuditActionKey));
      }

      const [countRow] = await app.db.read
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(SiteAudits)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const pagination = normalizePagination(
        parsed.data.page ?? 1,
        parsed.data.pageSize ?? 20,
        countRow?.total ?? 0,
      );

      const rows = await app.db.read
        .select({
          id: SiteAudits.id,
          action: SiteAudits.action,
          status: SiteAudits.status,
          site_id: SiteAudits.site_id,
          submitter_name: SiteAudits.submitter_name,
          submitter_email: SiteAudits.submitter_email,
          submit_reason: SiteAudits.submit_reason,
          created_time: SiteAudits.created_time,
          reviewed_time: SiteAudits.reviewed_time,
          current_snapshot: SiteAudits.current_snapshot,
          proposed_snapshot: SiteAudits.proposed_snapshot,
        })
        .from(SiteAudits)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(SiteAudits.created_time))
        .limit(pagination.pageSize)
        .offset((pagination.page - 1) * pagination.pageSize);

      const items = rows.map((row) => ({
        id: row.id,
        action: row.action,
        status: row.status,
        site_id: row.site_id,
        site_name: deps.resolveAuditSiteName(
          row.proposed_snapshot as SiteAuditSnapshot | null | undefined,
          row.current_snapshot as SiteAuditSnapshot | null | undefined,
        ),
        submitter_name: row.submitter_name,
        submitter_email: row.submitter_email,
        submit_reason: row.submit_reason,
        created_time: row.created_time.toISOString(),
        reviewed_time: row.reviewed_time?.toISOString() ?? null,
      }));

      return {
        ok: true,
        data: {
          items,
          pagination,
        },
      };
    },
  );

  app.get<{ Params: { auditId: string } }>(
    '/api/management/site-audits/:auditId',
    {
      preHandler: deps.requireAdminReviewer,
      schema: {
        params: deps.auditIdParamJsonSchema,
        response: {
          200: deps.auditDetailResultSchema,
          400: deps.errorResponseSchema,
          404: deps.errorResponseSchema,
        },
      },
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = deps.siteIdParamSchema.safeParse({
        site_id: request.params.auditId,
      });

      if (!parsed.success || parsed.data.site_id === null) {
        return deps.sendApiError(reply, 400, 'INVALID_AUDIT_ID', 'auditId must be a valid UUID.');
      }

      const [audit] = await app.db.read
        .select({
          id: SiteAudits.id,
          action: SiteAudits.action,
          status: SiteAudits.status,
          site_id: SiteAudits.site_id,
          diff: SiteAudits.diff,
          current_snapshot: SiteAudits.current_snapshot,
          proposed_snapshot: SiteAudits.proposed_snapshot,
          review_override_snapshot: SiteAudits.review_override_snapshot,
          review_override_diff: SiteAudits.review_override_diff,
          submitter_name: SiteAudits.submitter_name,
          submitter_email: SiteAudits.submitter_email,
          submit_reason: SiteAudits.submit_reason,
          notify_by_email: SiteAudits.notify_by_email,
          reviewer_comment: SiteAudits.reviewer_comment,
          created_time: SiteAudits.created_time,
          reviewed_time: SiteAudits.reviewed_time,
        })
        .from(SiteAudits)
        .where(eq(SiteAudits.id, parsed.data.site_id))
        .limit(1);

      if (!audit) {
        return deps.sendApiError(reply, 404, 'AUDIT_NOT_FOUND', 'The target audit does not exist.');
      }

      const currentSnapshot = audit.current_snapshot as SiteAuditSnapshot | null | undefined;
      const proposedSnapshot = audit.proposed_snapshot as SiteAuditSnapshot | null | undefined;
      const reviewOverrideSnapshot = audit.review_override_snapshot as
        | SiteAuditSnapshot
        | null
        | undefined;
      const site_name = deps.resolveAuditSiteName(
        reviewOverrideSnapshot ?? proposedSnapshot,
        currentSnapshot,
      );
      const editableSnapshot =
        audit.action === 'CREATE' || audit.action === 'UPDATE'
          ? (proposedSnapshot ?? currentSnapshot ?? null)
          : null;
      const submittedChanges =
        audit.action === 'UPDATE' && proposedSnapshot
          ? buildSnapshotDiff(currentSnapshot ?? null, proposedSnapshot)
          : [];
      const effectiveSnapshot = reviewOverrideSnapshot ?? proposedSnapshot ?? null;
      const effectiveChanges =
        audit.action === 'UPDATE' && effectiveSnapshot
          ? buildSnapshotDiff(currentSnapshot ?? null, effectiveSnapshot)
          : [];
      const action_view = {
        kind: audit.action as 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE',
        changes: buildDiffViews(submittedChanges),
        effective_changes: buildDiffViews(effectiveChanges),
        review_override_changes: buildDiffViews(
          (audit.review_override_diff as SiteAuditDiffItem[] | null | undefined) ?? [],
        ),
        before_fields:
          audit.action === 'UPDATE' ? buildSnapshotFieldViews(currentSnapshot ?? null) : undefined,
        submitted_fields:
          audit.action === 'CREATE' || audit.action === 'UPDATE'
            ? buildSnapshotFieldViews(proposedSnapshot ?? null)
            : undefined,
        effective_fields:
          audit.action === 'CREATE' || audit.action === 'UPDATE'
            ? buildSnapshotFieldViews(effectiveSnapshot)
            : undefined,
        site_fields:
          audit.action === 'DELETE' || audit.action === 'RESTORE'
            ? buildSnapshotFieldViews(currentSnapshot ?? null, SITE_BRIEF_FIELD_ORDER)
            : undefined,
        reason:
          audit.action === 'DELETE' || audit.action === 'RESTORE'
            ? (audit.submit_reason ?? null)
            : null,
      };

      return {
        ok: true,
        data: {
          ...audit,
          site_name,
          editable_snapshot: editableSnapshot,
          action_view,
          created_time: audit.created_time.toISOString(),
          reviewed_time: audit.reviewed_time?.toISOString() ?? null,
        },
      };
    },
  );
}
