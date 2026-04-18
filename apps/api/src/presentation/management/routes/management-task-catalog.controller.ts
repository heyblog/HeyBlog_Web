import type { FastifyInstance } from 'fastify';

import { buildTaskCatalog } from '@/application/jobs/usecase';

import { requireManagementPermission } from './management-route.shared';

export function registerManagementTaskCatalogRoute(app: FastifyInstance): void {
  app.get(
    '/api/management/tasks/catalog',
    { preHandler: requireManagementPermission('task.manage') },
    async () => ({
      ok: true,
      data: buildTaskCatalog(),
    }),
  );
}
