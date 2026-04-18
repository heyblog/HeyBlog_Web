import { Jobs, TaskSchedules } from '@zhblogs/db';

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { requireManagementPermission } from './management-route.shared';
import {
  isJobStatusKey,
  isTaskTypeKey,
  normalizeTaskLimit,
  normalizeUuid,
  parseDateValue,
  serializeJob,
  serializeSchedule,
  type TaskOverviewQuery,
} from './management-task.shared';

export function registerManagementTaskOverviewRoute(app: FastifyInstance): void {
  app.get(
    '/api/management/tasks/overview',
    { preHandler: requireManagementPermission('task.manage') },
    async (request) => {
      const query = request.query as TaskOverviewQuery;
      const limit = normalizeTaskLimit(query.limit);
      const createdFrom = parseDateValue(query.created_from);
      const createdTo = parseDateValue(query.created_to);
      const siteID = normalizeUuid(query.site_id);

      const schedules = await app.db.read
        .select()
        .from(TaskSchedules)
        .orderBy(desc(TaskSchedules.updated_time))
        .limit(limit);
      const jobs = await app.db.read
        .select()
        .from(Jobs)
        .where(
          and(
            query.status && isJobStatusKey(query.status)
              ? eq(Jobs.status, query.status)
              : undefined,
            query.task_type && isTaskTypeKey(query.task_type)
              ? eq(Jobs.task_type, query.task_type)
              : undefined,
            query.trigger_source
              ? eq(Jobs.trigger_source, query.trigger_source as never)
              : undefined,
            createdFrom ? gte(Jobs.created_time, createdFrom) : undefined,
            createdTo ? lte(Jobs.created_time, createdTo) : undefined,
            siteID
              ? sql`coalesce(${Jobs.payload} -> 'target' ->> 'site_id', '') = ${siteID}
                  or exists (
                    select 1
                    from jsonb_array_elements_text(coalesce(${Jobs.payload} -> 'target' -> 'site_ids', '[]'::jsonb)) as item(value)
                    where item.value = ${siteID}
                  )`
              : undefined,
          ),
        )
        .orderBy(desc(Jobs.created_time))
        .limit(limit);

      return {
        ok: true,
        data: {
          schedules: schedules.map(serializeSchedule),
          jobs: jobs.map(serializeJob),
        },
      };
    },
  );
}
