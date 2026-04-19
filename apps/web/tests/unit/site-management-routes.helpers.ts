import { type POST as reviewPost } from '@/pages/management/site-submissions/[auditId]/review';
import { type POST as siteUpdatePost } from '@/pages/management/sites/[siteId]/update';

export const siteId = '11111111-1111-4111-8111-111111111111';
export const auditId = '22222222-2222-4222-8222-222222222222';

export const createSiteUpdateContext = (request: Request, currentSiteId = siteId) =>
  ({
    request,
    params: {
      siteId: currentSiteId,
    },
  }) as unknown as Parameters<typeof siteUpdatePost>[0];

export const createReviewContext = (request: Request, currentAuditId = auditId) =>
  ({
    request,
    params: {
      auditId: currentAuditId,
    },
    redirect: (location: string, status = 302) =>
      new Response(null, {
        status,
        headers: {
          location,
        },
      }),
  }) as unknown as Parameters<typeof reviewPost>[0];
