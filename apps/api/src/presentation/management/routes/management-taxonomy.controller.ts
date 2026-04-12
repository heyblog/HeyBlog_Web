import type { FastifyInstance } from 'fastify';

import { registerManagementTaxonomyTagRoutes } from './management-taxonomy-tags.controller';
import { registerManagementTaxonomyTechnologyRoutes } from './management-taxonomy-technologies.controller';

export function registerManagementTaxonomyRoutes(app: FastifyInstance): void {
  registerManagementTaxonomyTagRoutes(app);
  registerManagementTaxonomyTechnologyRoutes(app);
}
