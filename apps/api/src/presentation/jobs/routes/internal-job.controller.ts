import type { FastifyInstance } from 'fastify';

import { enqueueJob, enqueueJobs } from '@/application/jobs/usecase/job-queue.usecase';

import { batchSchema, enqueueItemSchema } from '../dto/job-request.dto';

import { ensureInternalToken, parseEnqueueError, sendError } from './job-route.service';

export function registerInternalJobRoutes(app: FastifyInstance) {
  app.post('/api/internal/jobs', async (request, reply) => {
    if (!ensureInternalToken(request, app)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Invalid internal token.');
    }

    const parsed = enqueueItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, 'INVALID_PAYLOAD', 'Invalid enqueue payload.');
    }

    try {
      const data = await enqueueJob(app, {
        ...parsed.data,
      });

      return {
        ok: true,
        data,
      };
    } catch (error) {
      return parseEnqueueError(reply, error);
    }
  });

  app.post('/api/internal/jobs/batch', async (request, reply) => {
    if (!ensureInternalToken(request, app)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Invalid internal token.');
    }

    const parsed = batchSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, 'INVALID_PAYLOAD', 'Invalid batch enqueue payload.');
    }

    try {
      const result = await enqueueJobs(app, parsed.data.items);

      return {
        ok: true,
        data: {
          created: result.created,
          failed_items: result.failed,
        },
      };
    } catch (error) {
      return parseEnqueueError(reply, error);
    }
  });
}
