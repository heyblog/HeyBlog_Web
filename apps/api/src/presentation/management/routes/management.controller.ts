import type { FastifyInstance } from 'fastify';

import { registerManagementFeedbackRoutes } from './management-feedback.controller';
import { registerManagementLogRoutes } from './management-log.controller';
import { registerManagementSiteRoutes } from './management-site.controller';
import { registerManagementTaskRoutes } from './management-task.controller';
import { registerManagementTaxonomyRoutes } from './management-taxonomy.controller';

export function registerManagementRoutes(app: FastifyInstance): void {
  registerManagementFeedbackRoutes(app);
  registerManagementTaxonomyRoutes(app);
  registerManagementSiteRoutes(app);
  registerManagementTaskRoutes(app);
  registerManagementLogRoutes(app);
}
