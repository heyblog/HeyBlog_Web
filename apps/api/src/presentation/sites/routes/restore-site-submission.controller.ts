import { type SiteAuditDiffItem, SiteAudits, type SiteAuditSnapshot } from '@zhblogs/db';

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
  details?: Record<string, unknown>,
) => unknown;

type RestoreSubmissionInput = {
  site_id: string;
  submitter_name: string | null;
  submitter_email: string | null;
  restore_reason: string;
  notify_by_email: boolean;
};

type RestoreRouteDeps = {
  siteIdParamJsonSchema: unknown;
  submissionResultSchema: unknown;
  restoreTargetResultSchema: unknown;
  errorResponseSchema: unknown;
  enforceSubmissionRateLimit: preHandlerHookHandler;
  siteIdParamSchema: SafeParser<{ site_id: string | null }>;
  restoreSiteSubmissionSchema: SafeParser<RestoreSubmissionInput>;
  normalizeSubmitterName: (name: string | null | undefined) => string | null;
  normalizeSubmitterEmail: (email: string | null | undefined) => string | null;
  validateRestoreSiteFields: (payload: RestoreSubmissionInput) => string[];
  sendApiError: ErrorResponder;
  loadHiddenSiteRestoreTarget: (
    app: FastifyInstance,
    siteId: string,
  ) => Promise<{
    site_id: string;
    bid: string | null;
    name: string;
    url: string;
    reason: string | null;
  } | null>;
  loadCurrentSiteSnapshot: (
    app: FastifyInstance,
    siteId: string,
  ) => Promise<SiteAuditSnapshot | null>;
  loadPendingSiteAuditSummary: (
    app: FastifyInstance,
    siteId: string,
  ) => Promise<{
    audit_id: string;
    action: string;
    status: string;
    created_time: string;
    site_id: string | null;
  } | null>;
  buildRestoreSnapshot: (currentSnapshot: SiteAuditSnapshot) => SiteAuditSnapshot;
  buildSnapshotDiff: (
    before: SiteAuditSnapshot | null,
    after: SiteAuditSnapshot,
  ) => SiteAuditDiffItem[];
  reviewSubmittedSiteDuplicates: (
    app: FastifyInstance,
    snapshot: SiteAuditSnapshot,
    ignoreSiteId?: string,
  ) => Promise<{
    strong: Array<{
      site_id: string;
      bid: string | null;
      name: string;
      url: string;
      visibility: 'VISIBLE' | 'HIDDEN';
      reason: string;
    }>;
    weak: Array<{
      site_id: string;
      bid: string | null;
      name: string;
      url: string;
      visibility: 'VISIBLE' | 'HIDDEN';
      reason: string;
    }>;
  }>;
};

export function registerRestoreSubmissionRoute(app: FastifyInstance, deps: RestoreRouteDeps): void {
  app.get<{ Params: { siteId: string } }>(
    '/api/sites/:siteId/restorations/target',
    {
      schema: {
        params: deps.siteIdParamJsonSchema,
        response: {
          200: deps.restoreTargetResultSchema,
          400: deps.errorResponseSchema,
          404: deps.errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const parsed = deps.siteIdParamSchema.safeParse({
        site_id: request.params.siteId,
      });

      if (!parsed.success || parsed.data.site_id === null) {
        return deps.sendApiError(reply, 400, 'INVALID_SITE_ID', 'siteId must be a valid UUID.');
      }

      const target = await deps.loadHiddenSiteRestoreTarget(app, parsed.data.site_id);

      if (!target) {
        return deps.sendApiError(
          reply,
          404,
          'RESTORE_TARGET_NOT_FOUND',
          'The requested restore target does not exist or is already public.',
        );
      }

      return {
        ok: true,
        data: target,
      };
    },
  );

  app.post<{ Params: { siteId: string } }>(
    '/api/sites/:siteId/restorations',
    {
      schema: {
        params: deps.siteIdParamJsonSchema,
        response: {
          201: deps.submissionResultSchema,
          400: deps.errorResponseSchema,
          404: deps.errorResponseSchema,
          409: deps.errorResponseSchema,
          429: deps.errorResponseSchema,
          503: deps.errorResponseSchema,
        },
      },
      preHandler: deps.enforceSubmissionRateLimit,
    },
    async (request, reply) => {
      const parsedParams = deps.siteIdParamSchema.safeParse({
        site_id: request.params.siteId,
      });
      const parsedBody = deps.restoreSiteSubmissionSchema.safeParse(request.body);

      if (!parsedParams.success || parsedParams.data.site_id === null) {
        return deps.sendApiError(reply, 400, 'INVALID_SITE_ID', 'siteId must be a valid UUID.');
      }

      if (!parsedBody.success || parsedBody.data.site_id !== parsedParams.data.site_id) {
        return deps.sendApiError(
          reply,
          400,
          'INVALID_BODY',
          'Request body is invalid for a site restore submission.',
        );
      }

      const payload = {
        ...parsedBody.data,
        submitter_name: deps.normalizeSubmitterName(parsedBody.data.submitter_name),
        submitter_email: deps.normalizeSubmitterEmail(parsedBody.data.submitter_email),
      };
      const invalidFields = deps.validateRestoreSiteFields(payload);

      if (invalidFields.length > 0) {
        return deps.sendApiError(
          reply,
          400,
          'INVALID_BODY',
          'Request body contains empty or malformed fields.',
          invalidFields,
        );
      }

      try {
        const [restoreTarget, currentSnapshot] = await Promise.all([
          deps.loadHiddenSiteRestoreTarget(app, parsedParams.data.site_id),
          deps.loadCurrentSiteSnapshot(app, parsedParams.data.site_id),
        ]);

        if (!restoreTarget || !currentSnapshot) {
          return deps.sendApiError(
            reply,
            404,
            'RESTORE_TARGET_NOT_FOUND',
            'The requested restore target does not exist or is already public.',
          );
        }

        const activeSubmission = await deps.loadPendingSiteAuditSummary(
          app,
          parsedParams.data.site_id,
        );

        if (activeSubmission) {
          return deps.sendApiError(
            reply,
            409,
            'PENDING_AUDIT_EXISTS',
            'There is already a pending submission for the target site.',
            undefined,
            {
              active_submission: activeSubmission,
            },
          );
        }

        const proposedSnapshot = deps.buildRestoreSnapshot(currentSnapshot);
        const duplicateReview = await deps.reviewSubmittedSiteDuplicates(
          app,
          proposedSnapshot,
          parsedParams.data.site_id,
        );

        if (duplicateReview.strong.length > 0) {
          return deps.sendApiError(
            reply,
            409,
            'SITE_CONFLICT',
            'Another active site already occupies the same strong-duplicate identifier.',
          );
        }

        const diff = deps.buildSnapshotDiff(currentSnapshot, proposedSnapshot);

        const [createdAudit] = await app.db.write
          .insert(SiteAudits)
          .values({
            site_id: parsedParams.data.site_id,
            action: 'RESTORE',
            current_snapshot: currentSnapshot,
            proposed_snapshot: proposedSnapshot,
            diff,
            submit_reason: payload.restore_reason,
            submitter_name: payload.submitter_name,
            submitter_email: payload.submitter_email,
            notify_by_email: payload.notify_by_email,
          })
          .returning({
            id: SiteAudits.id,
            status: SiteAudits.status,
          });

        if (!createdAudit) {
          throw new Error('site restore audit insert returned no row');
        }

        return reply.code(201).send({
          ok: true,
          data: {
            audit_id: createdAudit.id,
            action: 'RESTORE',
            status: createdAudit.status,
            site_id: parsedParams.data.site_id,
          },
        });
      } catch (error) {
        app.log.error({ error }, 'failed to create site restore submission audit');
        return deps.sendApiError(
          reply,
          503,
          'DEPENDENCY_ERROR',
          'Unable to persist the site restore submission right now.',
        );
      }
    },
  );
}
