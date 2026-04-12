import {
  JobExecutions,
  Jobs,
  type JobStatusKey,
  type ScheduleModeKey,
  TaskSchedules,
  type TaskTypeKey,
} from '@zhblogs/db';

import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  enqueueJob,
  isAllowedQueueName,
  retryDeadLetterJobs,
} from '@/application/jobs/usecase/job-queue.usecase';

import { requireManagementPermission, sendManagementError } from './management-route.shared';

export function registerManagementTaskRoutes(app: FastifyInstance): void {
  app.get(
    '/api/management/tasks/overview',
    {
      preHandler: requireManagementPermission('task.manage'),
    },
    async (request) => {
      const query = request.query as { status?: string; queue_name?: string };
      const jobFilters = [
        query.status ? eq(Jobs.status, query.status as JobStatusKey) : undefined,
        query.queue_name ? eq(Jobs.queue_name, query.queue_name) : undefined,
      ].filter(Boolean);

      const [schedules, jobs] = await Promise.all([
        app.db.read.select().from(TaskSchedules).orderBy(asc(TaskSchedules.name)),
        app.db.read
          .select()
          .from(Jobs)
          .where(jobFilters.length > 0 ? and(...jobFilters) : undefined)
          .orderBy(desc(Jobs.created_time))
          .limit(50),
      ]);

      const latestExecutions =
        jobs.length > 0
          ? await app.db.read
              .select()
              .from(JobExecutions)
              .where(
                inArray(
                  JobExecutions.job_id,
                  jobs.map((job) => job.id),
                ),
              )
              .orderBy(desc(JobExecutions.started_time))
          : [];

      const latestExecutionByJobId = new Map<string, (typeof latestExecutions)[number]>();

      for (const execution of latestExecutions) {
        if (!latestExecutionByJobId.has(execution.job_id)) {
          latestExecutionByJobId.set(execution.job_id, execution);
        }
      }

      return {
        ok: true,
        data: {
          schedules: schedules.map((row) => ({
            ...row,
            next_run_time: row.next_run_time?.toISOString() ?? null,
            last_run_time: row.last_run_time?.toISOString() ?? null,
            created_time: row.created_time.toISOString(),
            updated_time: row.updated_time.toISOString(),
          })),
          jobs: jobs.map((row) => {
            const execution = latestExecutionByJobId.get(row.id);
            return {
              ...row,
              run_at: row.run_at.toISOString(),
              locked_at: row.locked_at?.toISOString() ?? null,
              heartbeat_time: row.heartbeat_time?.toISOString() ?? null,
              started_time: row.started_time?.toISOString() ?? null,
              finished_time: row.finished_time?.toISOString() ?? null,
              next_retry_time: row.next_retry_time?.toISOString() ?? null,
              created_time: row.created_time.toISOString(),
              updated_time: row.updated_time.toISOString(),
              latest_execution: execution
                ? {
                    id: execution.id,
                    status: execution.status,
                    started_time: execution.started_time.toISOString(),
                    finished_time: execution.finished_time?.toISOString() ?? null,
                    error_message: execution.error_message ?? null,
                  }
                : null,
            };
          }),
        },
      };
    },
  );

  app.post(
    '/api/management/tasks/schedules',
    {
      preHandler: requireManagementPermission('task.manage'),
    },
    async (request, reply) => {
      const body = request.body as {
        id?: string;
        name?: string;
        task_type?: string;
        queue_name?: string;
        schedule_mode?: string;
        is_enabled?: boolean;
        schedule_config?: Record<string, unknown>;
        trigger_rule?: Record<string, unknown>;
        payload_template?: Record<string, unknown>;
        policy?: Record<string, unknown>;
      };

      if (
        !body.name?.trim() ||
        !body.task_type ||
        !body.queue_name?.trim() ||
        !body.schedule_mode
      ) {
        return sendManagementError(
          reply,
          400,
          'INVALID_BODY',
          'name, task_type, queue_name and schedule_mode are required.',
        );
      }

      const values = {
        name: body.name.trim(),
        task_type: body.task_type as TaskTypeKey,
        queue_name: body.queue_name.trim(),
        schedule_mode: body.schedule_mode as ScheduleModeKey,
        is_enabled: body.is_enabled ?? true,
        schedule_config: body.schedule_config ?? {},
        trigger_rule: body.trigger_rule ?? {},
        payload_template: body.payload_template ?? {},
        policy: body.policy ?? {},
      };

      const rows = body.id
        ? await app.db.write
            .update(TaskSchedules)
            .set(values)
            .where(eq(TaskSchedules.id, body.id))
            .returning()
        : await app.db.write.insert(TaskSchedules).values(values).returning();
      const row = Array.isArray(rows) ? (rows[0] ?? null) : null;

      return {
        ok: true,
        data: row,
      };
    },
  );

  app.post<{ Params: { scheduleId: string } }>(
    '/api/management/tasks/schedules/:scheduleId/toggle',
    {
      preHandler: requireManagementPermission('task.manage'),
    },
    async (request, reply) => {
      const [schedule] = await app.db.read
        .select()
        .from(TaskSchedules)
        .where(eq(TaskSchedules.id, request.params.scheduleId))
        .limit(1);

      if (!schedule) {
        return sendManagementError(
          reply,
          404,
          'SCHEDULE_NOT_FOUND',
          'The target schedule does not exist.',
        );
      }

      const [updated] = await app.db.write
        .update(TaskSchedules)
        .set({
          is_enabled: !schedule.is_enabled,
          updated_time: new Date(),
        })
        .where(eq(TaskSchedules.id, schedule.id))
        .returning();

      return {
        ok: true,
        data: updated,
      };
    },
  );

  app.post<{ Params: { scheduleId: string } }>(
    '/api/management/tasks/schedules/:scheduleId/run',
    {
      preHandler: requireManagementPermission('task.manage'),
    },
    async (request, reply) => {
      const [schedule] = await app.db.read
        .select()
        .from(TaskSchedules)
        .where(eq(TaskSchedules.id, request.params.scheduleId))
        .limit(1);

      if (!schedule) {
        return sendManagementError(
          reply,
          404,
          'SCHEDULE_NOT_FOUND',
          'The target schedule does not exist.',
        );
      }

      if (!isAllowedQueueName(schedule.queue_name)) {
        return sendManagementError(
          reply,
          422,
          'QUEUE_NOT_ALLOWED',
          'The selected schedule uses an unsupported queue_name for manual trigger.',
        );
      }

      const result = await enqueueJob(app, {
        task_type: schedule.task_type as TaskTypeKey,
        queue_name: schedule.queue_name,
        trigger_source: 'MANUAL',
        trigger_key: `schedule:${schedule.id}`,
        payload: (schedule.payload_template as Record<string, unknown>) ?? {},
      });

      return {
        ok: true,
        data: result,
      };
    },
  );

  app.post(
    '/api/management/tasks/retry',
    {
      preHandler: requireManagementPermission('task.manage'),
    },
    async (request, reply) => {
      const body = request.body as { job_ids?: string[] };

      if (!Array.isArray(body.job_ids)) {
        return sendManagementError(reply, 400, 'INVALID_BODY', 'job_ids must be an array.');
      }

      return {
        ok: true,
        data: await retryDeadLetterJobs(app, body.job_ids),
      };
    },
  );
}
