import type { MultiFeed } from '@zhblogs/db';

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { createSystemSiteCorrectionAudit } from '@/application/sites/usecase/site-correction-audit.usecase';
import { ensureInternalToken, sendError } from '@/presentation/jobs/routes/job-route.service';

const correctionFeedSchema = z.object({
  name: z.string(),
  url: z.string(),
  type: z.string().optional(),
  isDefault: z.boolean(),
});

const correctionPayloadSchema = z.object({
  site_id: z.uuid(),
  url: z.string().url().optional(),
  feed: z.array(correctionFeedSchema).optional(),
  sitemap: z.string().url().nullable().optional(),
  link_page: z.string().url().nullable().optional(),
  submit_reason: z.string().optional(),
});

function toFeedList(
  feed: Array<z.infer<typeof correctionFeedSchema>> | undefined,
): MultiFeed[] | undefined {
  if (!feed) {
    return undefined;
  }

  return feed.map((item) => ({
    name: item.name,
    url: item.url,
    type: item.type as MultiFeed['type'],
    isDefault: item.isDefault,
  }));
}

export function registerInternalSiteCorrectionRoute(app: FastifyInstance): void {
  app.post('/api/internal/site-corrections', async (request, reply) => {
    if (!ensureInternalToken(request, app)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Invalid internal token.');
    }

    const parsed = correctionPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, 'INVALID_PAYLOAD', 'Invalid site correction payload.');
    }

    try {
      return {
        ok: true,
        data: await createSystemSiteCorrectionAudit(app, {
          site_id: parsed.data.site_id,
          url: parsed.data.url,
          feed: toFeedList(parsed.data.feed),
          sitemap: parsed.data.sitemap,
          link_page: parsed.data.link_page,
          submit_reason: parsed.data.submit_reason,
        }),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'SITE_NOT_FOUND') {
        return sendError(reply, 404, 'SITE_NOT_FOUND', 'Site not found.');
      }

      return sendError(reply, 503, 'SITE_CORRECTION_FAILED', 'Unable to create correction audit.');
    }
  });
}
