import type { FastifyInstance } from 'fastify';

import { enqueueJob } from '@/application/jobs/usecase';

import { requireManagementPermission, sendManagementError } from './management-route.shared';
import { buildSiteTaskPayload, normalizeUuid } from './management-task.shared';

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readFeedMode(value: unknown): 'DEFAULT_ONLY' | 'ALL' {
  return value === 'ALL' ? 'ALL' : 'DEFAULT_ONLY';
}

export function registerManagementTaskManualRoutes(app: FastifyInstance): void {
  app.post(
    '/api/management/tasks/manual/site-check',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      const body = request.body as {
        site_id?: string;
        request_config_id?: string;
        run_content_validation?: boolean;
        run_global_check?: boolean;
      };
      const siteID = normalizeUuid(body.site_id);
      if (!siteID) {
        return sendManagementError(reply, 400, 'INVALID_SITE_ID', 'site_id must be a valid UUID.');
      }

      return {
        ok: true,
        data: await enqueueJob(app, {
          task_type: 'SITE_CHECK',
          trigger_source: 'MANUAL',
          payload: {
            ...buildSiteTaskPayload(siteID, {
              run_content_validation: readBoolean(body.run_content_validation),
              run_global_check: readBoolean(body.run_global_check),
              source: 'management-manual',
            }),
            ...(normalizeUuid(body.request_config_id)
              ? { request_config_id: normalizeUuid(body.request_config_id) }
              : {}),
          },
        }),
      };
    },
  );

  app.post(
    '/api/management/tasks/manual/rss-fetch',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      const body = request.body as {
        site_id?: string;
        request_config_id?: string;
        feed_mode?: string;
        feed_url?: string;
      };
      const siteID = normalizeUuid(body.site_id);
      if (!siteID) {
        return sendManagementError(reply, 400, 'INVALID_SITE_ID', 'site_id must be a valid UUID.');
      }

      return {
        ok: true,
        data: await enqueueJob(app, {
          task_type: 'RSS_FETCH',
          trigger_source: 'MANUAL',
          payload: {
            ...buildSiteTaskPayload(siteID, {
              feed_mode: readFeedMode(body.feed_mode),
              source: 'management-manual',
              ...(typeof body.feed_url === 'string' && body.feed_url.trim()
                ? { feed_urls: [body.feed_url.trim()] }
                : {}),
            }),
            ...(normalizeUuid(body.request_config_id)
              ? { request_config_id: normalizeUuid(body.request_config_id) }
              : {}),
          },
        }),
      };
    },
  );
}
