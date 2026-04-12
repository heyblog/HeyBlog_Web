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

type CreateSubmissionInput = {
  submitter_name: string | null;
  submitter_email: string | null;
  submit_reason: string;
  notify_by_email: boolean;
  duplicate_review?: {
    confirmed_site_ids: string[];
  };
  site: {
    name: string;
    url: string;
    sign?: string | null;
    icon_base64?: string | null;
    feed?: SiteAuditSnapshot['feed'];
    sitemap?: string | null;
    link_page?: string | null;
    main_tag_id?: string | null;
    sub_tags?: SiteAuditSnapshot['sub_tags'];
    architecture?: SiteAuditSnapshot['architecture'];
  };
};

type CreateRouteDeps = {
  submissionResultSchema: unknown;
  errorResponseSchema: unknown;
  enforceSubmissionRateLimit: preHandlerHookHandler;
  createSiteSubmissionSchema: SafeParser;
  normalizeSubmitterName: (name: string | null | undefined) => string | null;
  normalizeSubmitterEmail: (email: string | null | undefined) => string | null;
  validateCreateSiteFields: (payload: CreateSubmissionInput) => string[];
  sendApiError: ErrorResponder;
  buildCreateSnapshot: (site: CreateSubmissionInput['site']) => SiteAuditSnapshot;
  materializeSiteAuditSnapshot: (
    app: FastifyInstance,
    snapshot: SiteAuditSnapshot,
  ) => Promise<SiteAuditSnapshot>;
  validateFeedSelection: (feed: SiteAuditSnapshot['feed'], fieldPrefix: string) => string[];
  ensureTagIdsExist: (app: FastifyInstance, tagIds: string[]) => Promise<boolean>;
  buildSelectedTagIds: (
    mainTag?: SiteAuditSnapshot['main_tag'] | string | null,
    subTags?: SiteAuditSnapshot['sub_tags'],
  ) => string[] | null;
  ensureTechnologyIdsExist: (
    app: FastifyInstance,
    architecture: SiteAuditSnapshot['architecture'],
  ) => Promise<boolean>;
  reviewSubmittedSiteDuplicates: (
    app: FastifyInstance,
    snapshot: SiteAuditSnapshot,
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
  loadPendingCreateAuditSummary: (
    app: FastifyInstance,
    snapshot: Pick<SiteAuditSnapshot, 'url' | 'bid'>,
  ) => Promise<{
    audit_id: string;
    action: string;
    status: string;
    created_time: string;
    site_id: string | null;
  } | null>;
  hasConfirmedWeakDuplicateReview: (
    weakCandidates: Array<{
      site_id: string;
      bid: string | null;
      name: string;
      url: string;
      visibility: 'VISIBLE' | 'HIDDEN';
      reason: string;
    }>,
    confirmedSiteIds: string[] | null | undefined,
  ) => boolean;
  buildSnapshotDiff: (
    before: SiteAuditSnapshot | null,
    after: SiteAuditSnapshot,
  ) => SiteAuditDiffItem[];
};

export function registerCreateSubmissionRoute(app: FastifyInstance, deps: CreateRouteDeps): void {
  app.post(
    '/api/sites',
    {
      schema: {
        tags: ['sites'],
        summary: 'Submit a new site for review',
        response: {
          201: deps.submissionResultSchema,
          400: deps.errorResponseSchema,
          409: deps.errorResponseSchema,
          429: deps.errorResponseSchema,
          503: deps.errorResponseSchema,
        },
      },
      preHandler: deps.enforceSubmissionRateLimit,
    },
    async (request, reply) => {
      const parsed = deps.createSiteSubmissionSchema.safeParse(request.body);

      if (!parsed.success) {
        return deps.sendApiError(
          reply,
          400,
          'INVALID_BODY',
          'Request body is invalid for a site creation submission.',
        );
      }

      const payload = {
        ...(parsed.data as CreateSubmissionInput),
        submitter_name: deps.normalizeSubmitterName(parsed.data.submitter_name),
        submitter_email: deps.normalizeSubmitterEmail(parsed.data.submitter_email),
      };
      const invalidFields = deps.validateCreateSiteFields(payload);

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
        const rawProposedSnapshot = deps.buildCreateSnapshot(payload.site);
        const feedFields = deps.validateFeedSelection(rawProposedSnapshot.feed, 'site.');

        if (feedFields.length > 0) {
          return deps.sendApiError(
            reply,
            400,
            'INVALID_BODY',
            'Request body contains empty or malformed fields.',
            feedFields,
          );
        }

        const pendingSubmission = await deps.loadPendingCreateAuditSummary(
          app,
          rawProposedSnapshot,
        );

        if (pendingSubmission) {
          return deps.sendApiError(
            reply,
            409,
            'PENDING_AUDIT_EXISTS',
            'There is already a pending submission for the target site.',
            undefined,
            {
              active_submission: pendingSubmission,
            },
          );
        }

        const [tagsValid, architectureValid, duplicateReview] = await Promise.all([
          deps.ensureTagIdsExist(
            app,
            deps.buildSelectedTagIds(payload.site.main_tag_id, payload.site.sub_tags) ?? [],
          ),
          deps.ensureTechnologyIdsExist(app, rawProposedSnapshot.architecture),
          deps.reviewSubmittedSiteDuplicates(app, rawProposedSnapshot),
        ]);

        if (!tagsValid) {
          return deps.sendApiError(
            reply,
            400,
            'INVALID_TAG_IDS',
            'One or more submitted tag IDs do not exist or are disabled.',
            ['site.main_tag_id', 'site.sub_tags'],
          );
        }

        if (!architectureValid) {
          return deps.sendApiError(
            reply,
            400,
            'INVALID_ARCHITECTURE',
            'One or more submitted technology IDs do not match the expected catalog type.',
            ['site.architecture'],
          );
        }

        const strongVisible = duplicateReview.strong.filter(
          (candidate) => candidate.visibility === 'VISIBLE',
        );
        const strongHidden = duplicateReview.strong.filter(
          (candidate) => candidate.visibility === 'HIDDEN',
        );

        if (strongVisible.length > 0) {
          return reply.code(409).send({
            ok: false,
            error: {
              code: 'SITE_DUPLICATE_STRONG_CONTACT_REQUIRED',
              message: '检测到已存在的公开站点，请不要重复新增；如需确认，请通过邮箱反馈。',
              duplicate_review: {
                strong: strongVisible,
                weak: duplicateReview.weak,
              },
            },
          });
        }

        if (strongHidden.length > 0) {
          return reply.code(409).send({
            ok: false,
            error: {
              code: 'SITE_RESTORE_REQUIRED',
              message: '检测到已下线的同站点记录，请改走恢复流程。',
              duplicate_review: {
                strong: strongHidden,
                weak: duplicateReview.weak,
              },
            },
          });
        }

        if (
          duplicateReview.weak.length > 0 &&
          !deps.hasConfirmedWeakDuplicateReview(
            duplicateReview.weak,
            payload.duplicate_review?.confirmed_site_ids,
          )
        ) {
          return reply.code(409).send({
            ok: false,
            error: {
              code: 'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED',
              message: '检测到疑似重复站点，请确认后再继续提交。',
              duplicate_review: {
                strong: [],
                weak: duplicateReview.weak,
              },
            },
          });
        }

        const proposedSnapshot = await deps.materializeSiteAuditSnapshot(app, rawProposedSnapshot);
        const diff = deps.buildSnapshotDiff(null, proposedSnapshot);

        const [createdAudit] = await app.db.write
          .insert(SiteAudits)
          .values({
            action: 'CREATE',
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
          throw new Error('site creation audit insert returned no row');
        }

        return reply.code(201).send({
          ok: true,
          data: {
            audit_id: createdAudit.id,
            action: 'CREATE',
            status: createdAudit.status,
            site_id: null,
          },
        });
      } catch (error) {
        app.log.error({ error }, 'failed to create site submission audit');
        return deps.sendApiError(
          reply,
          503,
          'DEPENDENCY_ERROR',
          'Unable to persist the site creation submission right now.',
        );
      }
    },
  );
}
