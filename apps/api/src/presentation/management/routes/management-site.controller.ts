import type { FastifyInstance } from 'fastify';

import { registerManagementSiteDetailRoute } from './management-site-detail.controller';
import { registerManagementSiteListRoute } from './management-site-list.controller';
import { registerManagementSiteUpdateRoute } from './management-site-update.controller';

export function registerManagementSiteRoutes(app: FastifyInstance): void {
  registerManagementSiteListRoute(app);
  registerManagementSiteDetailRoute(app);
  registerManagementSiteUpdateRoute(app);
}
