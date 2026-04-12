import { type SiteAuditActionKey, type SiteAuditDiffItem, SiteAudits } from '@zhblogs/db';

import { and, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { loadCurrentSiteSnapshot } from '@/infrastructure/sites/db/site.repository';

import { requireManagementPermission, sendManagementError } from './management-route.shared';
import { APPROVED_SITE_AUDIT_ACTIONS, summarizeSiteAuditChange } from './management-site.shared';

export function registerManagementSiteDetailRoute(app: FastifyInstance): void {
  app.get<{ Params: { siteId: string } }>(
    '/api/management/sites/:siteId',
    {
      preHandler: requireManagementPermission('site.manage'),
    },
    async (request, reply) => {
      const snapshot = await loadCurrentSiteSnapshot(app, request.params.siteId);

      if (!snapshot) {
        return sendManagementError(reply, 404, 'SITE_NOT_FOUND', 'The target site does not exist.');
      }

      const rows = await app.db.read
        .select({
          id: SiteAudits.id,
          action: SiteAudits.action,
          status: SiteAudits.status,
          submitter_name: SiteAudits.submitter_name,
          submit_reason: SiteAudits.submit_reason,
          reviewer_comment: SiteAudits.reviewer_comment,
          diff: SiteAudits.diff,
          created_time: SiteAudits.created_time,
          reviewed_time: SiteAudits.reviewed_time,
        })
        .from(SiteAudits)
        .where(
          and(
            eq(SiteAudits.site_id, request.params.siteId),
            eq(SiteAudits.status, 'APPROVED'),
            inArray(SiteAudits.action, APPROVED_SITE_AUDIT_ACTIONS),
          ),
        )
        .orderBy(desc(SiteAudits.created_time))
        .limit(20);

      return {
        ok: true,
        data: {
          snapshot,
          history: rows.map((row) => ({
            id: row.id,
            action: row.action,
            status: row.status,
            operator_name: row.submitter_name?.trim() || '系统',
            submit_reason: row.submit_reason,
            reviewer_comment: row.reviewer_comment,
            change_summary: summarizeSiteAuditChange(
              row.action as SiteAuditActionKey,
              row.diff as SiteAuditDiffItem[] | null,
            ),
            created_time: row.created_time.toISOString(),
            reviewed_time: row.reviewed_time?.toISOString() ?? null,
          })),
        },
      };
    },
  );
}
