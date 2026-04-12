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
) => unknown;

type UpdateSubmissionInput = {
  submitter_name: string | null;
  submitter_email: string | null;
  submit_reason: string;
  notify_by_email: boolean;
  changes: Record<string, unknown>;
};

type UpdateRouteDeps = {
  siteIdParamJsonSchema: unknown;
  submissionResultSchema: unknown;
  errorResponseSchema: unknown;
  enforceSubmissionRateLimit: preHandlerHookHandler;
  siteIdParamSchema: SafeParser;
  updateSiteSubmissionSchema: SafeParser;
  normalizeSubmitterName: (name: string | null | undefined) => string | null;
  normalizeSubmitterEmail: (email: string | null | undefined) => string | null;
  validateUpdateSiteFields: (payload: UpdateSubmissionInput) => string[];
  sendApiError: ErrorResponder;
  loadCurrentSiteSnapshot: (
    app: FastifyInstance,
    siteId: string,
  ) => Promise<SiteAuditSnapshot | null>;
  hasPendingSiteAudit: (app: FastifyInstance, siteId: string) => Promise<boolean>;
  buildUpdatedSnapshot: (
    currentSnapshot: SiteAuditSnapshot,
    changes: Record<string, unknown>,
  ) => SiteAuditSnapshot;
  materializeSiteAuditSnapshot: (
    app: FastifyInstance,
    snapshot: SiteAuditSnapshot,
  ) => Promise<SiteAuditSnapshot>;
  validateFeedSelection: (feed: SiteAuditSnapshot['feed'], fieldPrefix: string) => string[];
  buildSnapshotDiff: (
    before: SiteAuditSnapshot | null,
    after: SiteAuditSnapshot,
  ) => SiteAuditDiffItem[];
  hasOwn: (value: Record<string, unknown>, key: string) => boolean;
  ensureTagIdsExist: (app: FastifyInstance, tagIds: string[]) => Promise<boolean>;
  buildSelectedTagIds: (
    mainTag?: SiteAuditSnapshot['main_tag'] | string | null,
    subTags?: SiteAuditSnapshot['sub_tags'],
  ) => string[] | null;
  ensureTechnologyIdsExist: (
    app: FastifyInstance,
    architecture: SiteAuditSnapshot['architecture'],
  ) => Promise<boolean>;
  ensureNoSiteIdentifierConflict: (
    app: FastifyInstance,
    snapshot: SiteAuditSnapshot,
    ignoreSiteId?: string,
  ) => Promise<Array<'url' | 'bid' | 'name'> | null>;
};

export function registerUpdateSubmissionRoute(app: FastifyInstance, deps: UpdateRouteDeps): void {
  app.post(
    '/api/sites/:siteId/updates',
    {
      schema: {
        tags: ['sites'],
        summary: 'Submit an update request for an existing site',
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

      if (!paramResult.success) {
        return deps.sendApiError(reply, 400, 'INVALID_SITE_ID', 'siteId must be a valid UUID.');
      }

      const parsed = deps.updateSiteSubmissionSchema.safeParse(request.body);

      if (!parsed.success) {
        return deps.sendApiError(
          reply,
          400,
          'INVALID_BODY',
          'Request body is invalid for a site update submission.',
        );
      }

      const payload = {
        ...(parsed.data as UpdateSubmissionInput),
        submitter_name: deps.normalizeSubmitterName(parsed.data.submitter_name),
        submitter_email: deps.normalizeSubmitterEmail(parsed.data.submitter_email),
      };
      const invalidFields = deps.validateUpdateSiteFields(payload);

      if (invalidFields.length > 0) {
        return deps.sendApiError(
          reply,
          400,
          'INVALID_BODY',
          'Request body contains empty or malformed fields.',
          invalidFields,
        );
      }

      if (paramResult.data.site_id === null) {
        return deps.sendApiError(reply, 400, 'INVALID_SITE_ID', 'siteId must be a valid UUID.');
      }

      const siteId = paramResult.data.site_id;

      try {
        const currentSnapshot = await deps.loadCurrentSiteSnapshot(app, siteId);

        if (!currentSnapshot) {
          return deps.sendApiError(reply, 404, 'SITE_NOT_FOUND', 'The target site does not exist.');
        }

        if (await deps.hasPendingSiteAudit(app, siteId)) {
          return deps.sendApiError(
            reply,
            409,
            'PENDING_AUDIT_EXISTS',
            'There is already a pending submission for the target site.',
          );
        }

        const rawProposedSnapshot = deps.buildUpdatedSnapshot(currentSnapshot, payload.changes);
        const feedFields = deps.validateFeedSelection(rawProposedSnapshot.feed, 'changes.');

        if (feedFields.length > 0) {
          return deps.sendApiError(
            reply,
            400,
            'INVALID_BODY',
            'Request body contains empty or malformed fields.',
            feedFields,
          );
        }

        const [tagsValid, architectureValid, conflictFields] = await Promise.all([
          deps.hasOwn(payload.changes, 'main_tag_id') || deps.hasOwn(payload.changes, 'sub_tags')
            ? deps.ensureTagIdsExist(
                app,
                deps.buildSelectedTagIds(
                  rawProposedSnapshot.main_tag,
                  rawProposedSnapshot.sub_tags,
                ) ?? [],
              )
            : Promise.resolve(true),
          deps.hasOwn(payload.changes, 'architecture')
            ? deps.ensureTechnologyIdsExist(app, rawProposedSnapshot.architecture)
            : Promise.resolve(true),
          deps.ensureNoSiteIdentifierConflict(app, rawProposedSnapshot, siteId),
        ]);

        if (!tagsValid) {
          return deps.sendApiError(
            reply,
            400,
            'INVALID_TAG_IDS',
            'One or more submitted tag IDs do not exist or are disabled.',
            ['changes.main_tag_id', 'changes.sub_tags'],
          );
        }

        if (!architectureValid) {
          return deps.sendApiError(
            reply,
            400,
            'INVALID_ARCHITECTURE',
            'One or more submitted technology IDs do not match the expected catalog type.',
            ['changes.architecture'],
          );
        }

        if (conflictFields) {
          return deps.sendApiError(
            reply,
            409,
            'SITE_CONFLICT',
            'A site with the same unique identifier already exists.',
            conflictFields.map((field) => `changes.${field}`),
          );
        }

        const proposedSnapshot = await deps.materializeSiteAuditSnapshot(app, rawProposedSnapshot);
        const diff = deps.buildSnapshotDiff(currentSnapshot, proposedSnapshot);

        if (diff.length === 0) {
          return deps.sendApiError(
            reply,
            409,
            'NO_CHANGES',
            'The submitted update does not change any persisted site field.',
          );
        }

        const [createdAudit] = await app.db.write
          .insert(SiteAudits)
          .values({
            site_id: siteId,
            action: 'UPDATE',
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
          throw new Error('site update audit insert returned no row');
        }

        return reply.code(201).send({
          ok: true,
          data: {
            audit_id: createdAudit.id,
            action: 'UPDATE',
            status: createdAudit.status,
            site_id: siteId,
          },
        });
      } catch (error) {
        app.log.error({ error, siteId }, 'failed to create site update submission audit');
        return deps.sendApiError(
          reply,
          503,
          'DEPENDENCY_ERROR',
          'Unable to persist the site update submission right now.',
        );
      }
    },
  );
}
