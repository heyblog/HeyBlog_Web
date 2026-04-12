import {
  ArticleFeedbackAudits,
  type AuditStatusKey,
  FeedArticles,
  SiteFeedbackAudits,
  Sites,
} from '@zhblogs/db';

import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  type FeedbackDecision,
  normalizeOptionalString,
  requireManagementPermission,
  sendManagementError,
} from './management-route.shared';

export function registerManagementFeedbackRoutes(app: FastifyInstance): void {
  app.get(
    '/api/management/feedback/site',
    {
      preHandler: requireManagementPermission('feedback.review'),
    },
    async (request) => {
      const query = request.query as { status?: string };
      const filters = [
        query.status ? eq(SiteFeedbackAudits.status, query.status as AuditStatusKey) : undefined,
      ].filter(Boolean);

      const rows = await app.db.read
        .select({
          id: SiteFeedbackAudits.id,
          siteId: SiteFeedbackAudits.site_id,
          siteName: Sites.name,
          reasonType: SiteFeedbackAudits.reason_type,
          status: SiteFeedbackAudits.status,
          feedbackContent: SiteFeedbackAudits.feedback_content,
          reporterName: SiteFeedbackAudits.reporter_name,
          reporterEmail: SiteFeedbackAudits.reporter_email,
          notifyByEmail: SiteFeedbackAudits.notify_by_email,
          reviewerComment: SiteFeedbackAudits.reviewer_comment,
          createdTime: SiteFeedbackAudits.created_time,
          reviewedTime: SiteFeedbackAudits.reviewed_time,
        })
        .from(SiteFeedbackAudits)
        .innerJoin(Sites, eq(SiteFeedbackAudits.site_id, Sites.id))
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(SiteFeedbackAudits.created_time))
        .limit(100);

      return {
        ok: true,
        data: rows.map((row) => ({
          ...row,
          createdTime: row.createdTime.toISOString(),
          reviewedTime: row.reviewedTime?.toISOString() ?? null,
        })),
      };
    },
  );

  app.post<{ Params: { feedbackId: string } }>(
    '/api/management/feedback/site/:feedbackId/review',
    {
      preHandler: requireManagementPermission('feedback.review'),
    },
    async (request, reply) => {
      const actor = await app.auth.getCurrentUser(request);
      const body = request.body as {
        decision?: FeedbackDecision;
        reviewer_comment?: string | null;
      };
      const decision = body.decision;

      if (decision !== 'APPROVED' && decision !== 'REJECTED') {
        return sendManagementError(
          reply,
          400,
          'INVALID_BODY',
          'decision must be APPROVED or REJECTED.',
        );
      }

      const [audit] = await app.db.read
        .select({
          id: SiteFeedbackAudits.id,
          status: SiteFeedbackAudits.status,
        })
        .from(SiteFeedbackAudits)
        .where(eq(SiteFeedbackAudits.id, request.params.feedbackId))
        .limit(1);

      if (!audit) {
        return sendManagementError(
          reply,
          404,
          'FEEDBACK_NOT_FOUND',
          'The target feedback does not exist.',
        );
      }

      if (audit.status !== 'PENDING') {
        return sendManagementError(
          reply,
          409,
          'FEEDBACK_ALREADY_REVIEWED',
          'The target feedback has already been reviewed.',
        );
      }

      await app.db.write
        .update(SiteFeedbackAudits)
        .set({
          status: decision,
          reviewer_comment: normalizeOptionalString(body.reviewer_comment),
          reviewed_by: actor.id,
          reviewed_time: new Date(),
          updated_time: new Date(),
        })
        .where(eq(SiteFeedbackAudits.id, audit.id));

      return {
        ok: true,
        data: {
          id: audit.id,
          status: decision,
        },
      };
    },
  );

  app.get(
    '/api/management/feedback/article',
    {
      preHandler: requireManagementPermission('feedback.review'),
    },
    async (request) => {
      const query = request.query as { status?: string };
      const filters = [
        query.status ? eq(ArticleFeedbackAudits.status, query.status as AuditStatusKey) : undefined,
      ].filter(Boolean);

      const rows = await app.db.read
        .select({
          id: ArticleFeedbackAudits.id,
          siteId: ArticleFeedbackAudits.site_id,
          siteName: Sites.name,
          articleId: ArticleFeedbackAudits.article_id,
          articleTitle: FeedArticles.title,
          articleUrl: FeedArticles.article_url,
          action: ArticleFeedbackAudits.action,
          reasonType: ArticleFeedbackAudits.reason_type,
          status: ArticleFeedbackAudits.status,
          feedbackContent: ArticleFeedbackAudits.feedback_content,
          reporterName: ArticleFeedbackAudits.reporter_name,
          reporterEmail: ArticleFeedbackAudits.reporter_email,
          reviewerComment: ArticleFeedbackAudits.reviewer_comment,
          createdTime: ArticleFeedbackAudits.created_time,
          reviewedTime: ArticleFeedbackAudits.reviewed_time,
        })
        .from(ArticleFeedbackAudits)
        .innerJoin(Sites, eq(ArticleFeedbackAudits.site_id, Sites.id))
        .innerJoin(FeedArticles, eq(ArticleFeedbackAudits.article_id, FeedArticles.id))
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(ArticleFeedbackAudits.created_time))
        .limit(100);

      return {
        ok: true,
        data: rows.map((row) => ({
          ...row,
          createdTime: row.createdTime.toISOString(),
          reviewedTime: row.reviewedTime?.toISOString() ?? null,
        })),
      };
    },
  );

  app.post<{ Params: { feedbackId: string } }>(
    '/api/management/feedback/article/:feedbackId/review',
    {
      preHandler: requireManagementPermission('feedback.review'),
    },
    async (request, reply) => {
      const actor = await app.auth.getCurrentUser(request);
      const body = request.body as {
        decision?: FeedbackDecision;
        reviewer_comment?: string | null;
      };
      const decision = body.decision;

      if (decision !== 'APPROVED' && decision !== 'REJECTED') {
        return sendManagementError(
          reply,
          400,
          'INVALID_BODY',
          'decision must be APPROVED or REJECTED.',
        );
      }

      const [audit] = await app.db.read
        .select({
          id: ArticleFeedbackAudits.id,
          articleId: ArticleFeedbackAudits.article_id,
          action: ArticleFeedbackAudits.action,
          reasonType: ArticleFeedbackAudits.reason_type,
          status: ArticleFeedbackAudits.status,
        })
        .from(ArticleFeedbackAudits)
        .where(eq(ArticleFeedbackAudits.id, request.params.feedbackId))
        .limit(1);

      if (!audit) {
        return sendManagementError(
          reply,
          404,
          'FEEDBACK_NOT_FOUND',
          'The target feedback does not exist.',
        );
      }

      if (audit.status !== 'PENDING') {
        return sendManagementError(
          reply,
          409,
          'FEEDBACK_ALREADY_REVIEWED',
          'The target feedback has already been reviewed.',
        );
      }

      const reviewerComment = normalizeOptionalString(body.reviewer_comment);

      if (decision === 'APPROVED') {
        await app.db.write
          .update(FeedArticles)
          .set({
            visibility: audit.action === 'DELETE' ? 'DELETED' : 'HIDDEN',
            visibility_reason: reviewerComment
              ? `${audit.reasonType} ｜ ${reviewerComment}`
              : `article feedback approved: ${audit.reasonType}`,
          })
          .where(eq(FeedArticles.id, audit.articleId));
      }

      await app.db.write
        .update(ArticleFeedbackAudits)
        .set({
          status: decision,
          reviewer_comment: reviewerComment,
          reviewed_by: actor.id,
          reviewed_time: new Date(),
          updated_time: new Date(),
        })
        .where(eq(ArticleFeedbackAudits.id, audit.id));

      return {
        ok: true,
        data: {
          id: audit.id,
          status: decision,
        },
      };
    },
  );
}
