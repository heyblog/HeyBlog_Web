import { type SiteAuditDiffItem, SiteAudits, type SiteAuditSnapshot } from '@zhblogs/db';

import type { FastifyInstance, FastifyReply, preHandlerHookHandler } from 'fastify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParseResult = { success: true; data: any } | { success: false };

type SafeParser = {
  safeParse: (input: unknown) => ParseResult;
};

type ErrorResponder = (
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  fields?: string[],
  details?: Record<string, unknown>,
) => unknown;

type DeleteSubmissionInput = {
  submitter_name: string | null;
  submitter_email: string | null;
  submit_reason: string;
  notify_by_email: boolean;
};

type DeleteRouteDeps = {
  siteIdParamJsonSchema: unknown;
  submissionResultSchema: unknown;
  errorResponseSchema: unknown;
  enforceSubmissionRateLimit: preHandlerHookHandler;
  siteIdParamSchema: SafeParser;
  submissionContactSchema: SafeParser;
  normalizeSubmitterName: (name: string | null | undefined) => string | null;
  normalizeSubmitterEmail: (email: string | null | undefined) => string | null;
  validateDeleteSiteFields: (payload: DeleteSubmissionInput) => string[];
  sendApiError: ErrorResponder;
  loadCurrentSiteSnapshot: (
    app: FastifyInstance,
    siteId: string,
  ) => Promise<SiteAuditSnapshot | null>;
  hasPendingSiteAudit: (app: FastifyInstance, siteId: string) => Promise<boolean>;
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
  buildDeleteSnapshot: (current: SiteAuditSnapshot, submitReason: string) => SiteAuditSnapshot;
  buildSnapshotDiff: (
    before: SiteAuditSnapshot | null,
    after: SiteAuditSnapshot,
  ) => SiteAuditDiffItem[];
};

export function registerDeleteSubmissionRoute(app: FastifyInstance, deps: DeleteRouteDeps): void {
  app.post(
    '/api/sites/:siteId/deletions',
    {
      schema: {
        tags: ['sites'],
        summary: 'Submit a soft delete request for an existing site',
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
      const paramResult = deps.siteIdParamSchema.safeParse({
        site_id: (request.params as { siteId?: string }).siteId,
      });

      if (!paramResult.success || paramResult.data.site_id === null) {
        return deps.sendApiError(reply, 400, 'INVALID_SITE_ID', 'siteId must be a valid UUID.');
      }

      const parsed = deps.submissionContactSchema.safeParse(request.body);

      if (!parsed.success) {
        return deps.sendApiError(
          reply,
          400,
          'INVALID_BODY',
          'Request body is invalid for a site delete submission.',
        );
      }

      const payload = {
        ...(parsed.data as DeleteSubmissionInput),
        submitter_name: deps.normalizeSubmitterName(parsed.data.submitter_name),
        submitter_email: deps.normalizeSubmitterEmail(parsed.data.submitter_email),
      };
      const invalidFields = deps.validateDeleteSiteFields(payload);

      if (invalidFields.length > 0) {
        return deps.sendApiError(
          reply,
          400,
          'INVALID_BODY',
          'Request body contains empty or malformed fields.',
          invalidFields,
        );
      }

      const siteId = paramResult.data.site_id;

      try {
        const currentSnapshot = await deps.loadCurrentSiteSnapshot(app, siteId);

        if (!currentSnapshot || currentSnapshot.is_show === false) {
          return deps.sendApiError(reply, 404, 'SITE_NOT_FOUND', 'The target site does not exist.');
        }

        if (await deps.hasPendingSiteAudit(app, siteId)) {
          const activeSubmission = await deps.loadPendingSiteAuditSummary(app, siteId);
          return deps.sendApiError(
            reply,
            409,
            'PENDING_AUDIT_EXISTS',
            'There is already a pending submission for the target site.',
            undefined,
            activeSubmission
              ? {
                  active_submission: activeSubmission,
                }
              : undefined,
          );
        }

        const proposedSnapshot = deps.buildDeleteSnapshot(currentSnapshot, payload.submit_reason);
        const diff = deps.buildSnapshotDiff(currentSnapshot, proposedSnapshot);

        const [createdAudit] = await app.db.write
          .insert(SiteAudits)
          .values({
            site_id: siteId,
            action: 'DELETE',
            current_snapshot: currentSnapshot,
            proposed_snapshot: proposedSnapshot,
            diff,
            submit_reason: payload.submit_reason,
            submitter_name: payload.submitter_name,
            submitter_email: payload.submitter_email,
            notify_by_email: payload.notify_by_email,
          })
          .returning({
            id: SiteAudits.id,
            status: SiteAudits.status,
          });

        if (!createdAudit) {
          throw new Error('site delete audit insert returned no row');
        }

        return reply.code(201).send({
          ok: true,
          data: {
            audit_id: createdAudit.id,
            action: 'DELETE',
            status: createdAudit.status,
            site_id: siteId,
          },
        });
      } catch (error) {
        app.log.error({ error, siteId }, 'failed to create site delete submission audit');
        return deps.sendApiError(
          reply,
          503,
          'DEPENDENCY_ERROR',
          'Unable to persist the site delete submission right now.',
        );
      }
    },
  );
}
