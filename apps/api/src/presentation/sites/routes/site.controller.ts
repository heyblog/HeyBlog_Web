import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  syncSiteArchitecture,
  syncSiteTags,
} from '@/application/sites/usecase/site-architecture-sync.usecase';
import {
  applyApprovedAudit,
  enqueueFeedDetectionJobs,
  finalizeAuditReview,
} from '@/application/sites/usecase/site-audit-application.usecase';
import { autoFillSite } from '@/application/sites/usecase/site-auto-fill.usecase';
import {
  hasPendingSiteAudit,
  loadAutoFillHints,
  loadPendingCreateAuditSummary,
  loadPendingSiteAuditSummary,
  loadSiteSearchResults,
  loadSubmissionOptions,
} from '@/application/sites/usecase/site-option.usecase';
import { hasManagementPermission } from '@/domain/auth/service/auth-role.service';
import { AuthError } from '@/domain/auth/types/auth.types';
import { hasConfirmedWeakDuplicateReview } from '@/domain/sites/service/site-duplicate-review.service';
import {
  buildCreateSnapshot,
  buildDeleteSnapshot,
  buildRestoreSnapshot,
  buildSelectedTagIds,
  buildSnapshotDiff,
  buildUpdatedSnapshot,
} from '@/domain/sites/service/site-snapshot.service';
import {
  hasOwn,
  normalizeSubmittedFeeds,
  normalizeSubmitterEmail,
  normalizeSubmitterName,
  resolveAuditSiteName,
  validateCreateSiteFields,
  validateDeleteSiteFields,
  validateFeedSelection,
  validateRestoreSiteFields,
  validateSiteLookupFields,
  validateSubmissionQueryFields,
  validateUpdateSiteFields,
} from '@/domain/sites/service/site-submission-validation.service';
import {
  ensureNoSiteIdentifierConflict,
  ensureTagIdsExist,
  ensureTechnologyIdsExist,
  loadCurrentSiteSnapshot,
  loadHiddenSiteRestoreTarget,
  materializeSiteAuditSnapshot,
  reviewSubmittedSiteDuplicates,
} from '@/infrastructure/sites/db/site.repository';
import {
  canSendSubmissionDecisionMail,
  sendSubmissionDecisionMail,
} from '@/infrastructure/sites/http/submission-decision-mail.service';

import {
  auditDetailResultSchema,
  auditIdParamJsonSchema,
  auditListResultSchema,
  autoFillResultSchema,
  errorResponseSchema,
  optionsResultSchema,
  restoreTargetResultSchema,
  siteIdParamJsonSchema,
  siteLookupResultSchema,
  siteSearchResultSchema,
  submissionQueryResultSchema,
  submissionResultSchema,
} from '../dto';
import {
  auditListQuerySchema,
  auditReviewSchema,
  createSiteSubmissionSchema,
  restoreSiteSubmissionSchema,
  siteAutoFillSchema,
  siteIdParamSchema,
  siteLookupSchema,
  siteSearchSchema,
  submissionContactSchema,
  submissionQuerySchema,
  updateSiteSubmissionSchema,
} from '../dto/site-request.dto';

import { registerAdminAuditReadRoutes } from './admin-site-audit-read.controller';
import { registerAdminAuditReviewRoute } from './admin-site-audit-review.controller';
import { registerCreateSubmissionRoute } from './create-site-submission.controller';
import { registerDeleteSubmissionRoute } from './delete-site-submission.controller';
import { registerRestoreSubmissionRoute } from './restore-site-submission.controller';
import { registerSiteDiscoveryRoutes } from './site-discovery.controller';
import {
  enforceSubmissionRateLimit,
  loadSiteLookupTarget,
  sendApiError,
} from './site-route.service';
import { registerSubmissionQueryRoute } from './site-submission-query.controller';
import { registerUpdateSubmissionRoute } from './update-site-submission.controller';

export function registerSiteRoutes(app: FastifyInstance): void {
  const requireAuditReviewer = async (request: FastifyRequest): Promise<void> => {
    const user = await app.auth.getCurrentUser(request);

    if (user.role === 'USER' || !hasManagementPermission(user, 'site_audit.review')) {
      throw new AuthError('forbidden', 'site_audit.review required', 403);
    }
  };

  registerSiteDiscoveryRoutes(app, {
    errorResponseSchema,
    siteSearchSchema,
    siteSearchResultSchema,
    loadSiteSearchResults,
    optionsResultSchema,
    loadSubmissionOptions,
    siteAutoFillSchema,
    autoFillResultSchema,
    loadAutoFillHints,
    autoFillSite,
    siteLookupSchema,
    siteLookupResultSchema,
    validateSiteLookupFields,
    loadSiteLookupTarget,
    loadCurrentSiteSnapshot,
    sendApiError,
  });

  registerSubmissionQueryRoute(app, {
    errorResponseSchema,
    submissionQueryResultSchema,
    submissionQuerySchema,
    validateSubmissionQueryFields,
    resolveAuditSiteName,
    sendApiError,
  });

  registerCreateSubmissionRoute(app, {
    submissionResultSchema,
    errorResponseSchema,
    enforceSubmissionRateLimit,
    createSiteSubmissionSchema,
    normalizeSubmitterName,
    normalizeSubmitterEmail,
    validateCreateSiteFields,
    sendApiError,
    buildCreateSnapshot,
    materializeSiteAuditSnapshot,
    validateFeedSelection,
    ensureTagIdsExist,
    buildSelectedTagIds,
    ensureTechnologyIdsExist,
    reviewSubmittedSiteDuplicates,
    hasConfirmedWeakDuplicateReview,
    buildSnapshotDiff,
    loadPendingCreateAuditSummary,
  });

  registerUpdateSubmissionRoute(app, {
    siteIdParamJsonSchema,
    submissionResultSchema,
    errorResponseSchema,
    enforceSubmissionRateLimit,
    siteIdParamSchema,
    updateSiteSubmissionSchema,
    normalizeSubmitterName,
    normalizeSubmitterEmail,
    validateUpdateSiteFields,
    sendApiError,
    loadCurrentSiteSnapshot,
    hasPendingSiteAudit,
    loadPendingSiteAuditSummary,
    buildUpdatedSnapshot,
    materializeSiteAuditSnapshot,
    validateFeedSelection,
    buildSnapshotDiff,
    hasOwn,
    ensureTagIdsExist,
    buildSelectedTagIds,
    ensureTechnologyIdsExist,
    ensureNoSiteIdentifierConflict,
  });

  registerDeleteSubmissionRoute(app, {
    siteIdParamJsonSchema,
    submissionResultSchema,
    errorResponseSchema,
    enforceSubmissionRateLimit,
    siteIdParamSchema,
    submissionContactSchema,
    normalizeSubmitterName,
    normalizeSubmitterEmail,
    validateDeleteSiteFields,
    sendApiError,
    loadCurrentSiteSnapshot,
    hasPendingSiteAudit,
    loadPendingSiteAuditSummary,
    buildDeleteSnapshot,
    buildSnapshotDiff,
  });

  registerRestoreSubmissionRoute(app, {
    siteIdParamJsonSchema,
    submissionResultSchema,
    restoreTargetResultSchema,
    errorResponseSchema,
    enforceSubmissionRateLimit,
    siteIdParamSchema,
    restoreSiteSubmissionSchema,
    normalizeSubmitterName,
    normalizeSubmitterEmail,
    validateRestoreSiteFields,
    sendApiError,
    loadHiddenSiteRestoreTarget,
    loadCurrentSiteSnapshot,
    loadPendingSiteAuditSummary,
    buildRestoreSnapshot,
    buildSnapshotDiff,
    reviewSubmittedSiteDuplicates,
  });

  registerAdminAuditReadRoutes(app, {
    requireAdminReviewer: requireAuditReviewer,
    errorResponseSchema,
    auditListResultSchema,
    auditDetailResultSchema,
    auditIdParamJsonSchema,
    auditListQuerySchema,
    siteIdParamSchema,
    sendApiError,
    resolveAuditSiteName,
  });

  registerAdminAuditReviewRoute(app, {
    requireAdminReviewer: requireAuditReviewer,
    auditIdParamJsonSchema,
    submissionResultSchema,
    errorResponseSchema,
    siteIdParamSchema,
    auditReviewSchema,
    sendApiError,
    applyApprovedAudit: (routeApp, audit) =>
      applyApprovedAudit(routeApp, audit, {
        ensureNoSiteIdentifierConflict,
        syncSiteTags,
        syncSiteArchitecture,
      }),
    finalizeAuditReview,
    loadCurrentSiteSnapshot,
    materializeSiteAuditSnapshot,
    enqueueFeedDetectionJobs: (routeApp, siteId, snapshot, triggerKey, action) =>
      enqueueFeedDetectionJobs(
        routeApp,
        siteId,
        snapshot,
        triggerKey,
        normalizeSubmittedFeeds,
        action,
      ),
    canSendSubmissionDecisionMail,
    sendSubmissionDecisionMail,
    resolveAuditSiteName,
  });
}
