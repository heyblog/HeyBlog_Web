import type { FastifyInstance } from 'fastify';

import { registerManagementTaskCatalogRoute } from './management-task-catalog.controller';
import { registerManagementTaskJobRoutes } from './management-task-job.controller';
import { registerManagementTaskManualRoutes } from './management-task-manual.controller';
import { registerManagementTaskOverviewRoute } from './management-task-overview.controller';
import { registerManagementTaskRequestConfigRoutes } from './management-task-request-config.controller';
import { registerManagementTaskScheduleRoutes } from './management-task-schedule.controller';

export function registerManagementTaskRoutes(app: FastifyInstance): void {
  registerManagementTaskCatalogRoute(app);
  registerManagementTaskOverviewRoute(app);
  registerManagementTaskRequestConfigRoutes(app);
  registerManagementTaskScheduleRoutes(app);
  registerManagementTaskManualRoutes(app);
  registerManagementTaskJobRoutes(app);
}
