import {
  type AuditStatusKey,
  type SiteAuditActionKey,
  type SiteAuditDiffItem,
  SiteAudits,
  type SiteAuditSnapshot,
} from '@zhblogs/db';

import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, preHandlerHookHandler } from 'fastify';

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
  auditListQuerySchema: SafeParser<{ status?: string; action?: string }>;
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
  feed: '订阅地址',
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

const formatAuditValueDisplay = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.map((item) => formatAuditValueDisplay(item)).join(' / ') : '—';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
};

const buildSnapshotFieldViews = (
  snapshot: SiteAuditSnapshot | null | undefined,
): Array<{ field: string; label: string; value_display: string }> => {
  if (!snapshot) {
    return [];
  }

  return Object.entries(snapshot)
    .filter(([, value]) => value !== undefined)
    .map(([field, value]) => ({
      field,
      label: SITE_AUDIT_FIELD_LABELS[field] ?? field,
      value_display: formatAuditValueDisplay(value),
    }));
};

const buildDiffViews = (
  diff: SiteAuditDiffItem[] | null | undefined,
): Array<{
  field: string;
  label: string;
  before_display: string;
  after_display: string;
}> =>
  (diff ?? []).map((item) => ({
    field: item.field,
    label: SITE_AUDIT_FIELD_LABELS[item.field] ?? item.field,
    before_display: formatAuditValueDisplay(item.before),
    after_display: formatAuditValueDisplay(item.after),
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
        .limit(60);

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
          pagination: {
            page: 1,
            pageSize: items.length,
            totalItems: items.length,
            totalPages: 1,
          },
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
      const site_name = deps.resolveAuditSiteName(proposedSnapshot, currentSnapshot);
      const editableSnapshot =
        audit.action === 'CREATE' || audit.action === 'UPDATE'
          ? (proposedSnapshot ?? currentSnapshot ?? null)
          : null;
      const action_view = {
        kind: audit.action as 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE',
        changes: buildDiffViews(audit.diff as SiteAuditDiffItem[] | null | undefined),
        submitted_fields:
          audit.action === 'CREATE' ? buildSnapshotFieldViews(proposedSnapshot ?? null) : undefined,
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
