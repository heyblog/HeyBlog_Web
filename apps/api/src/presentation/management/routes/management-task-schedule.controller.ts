import { type ScheduleModeKey, TaskSchedules, type TaskTypeKey } from '@zhblogs/db';

import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { enqueueJob, validateTaskPayload } from '@/application/jobs/usecase';

import { requireManagementPermission, sendManagementError } from './management-route.shared';
import {
  isScheduleModeKey,
  isTaskTypeKey,
  loadScheduleByID,
  normalizeUuid,
  sendTaskError,
  serializeSchedule,
} from './management-task.shared';

type ScheduleMutation = {
  id: string | null;
  name: string;
  task_type: TaskTypeKey;
  schedule_mode: ScheduleModeKey;
  request_config_id: string | null;
  is_enabled: boolean;
  schedule_config: Record<string, unknown>;
  payload_template: Record<string, unknown>;
};

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function parseScheduleMutation(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const taskType = typeof body.task_type === 'string' ? body.task_type.trim() : '';
  const scheduleMode = typeof body.schedule_mode === 'string' ? body.schedule_mode.trim() : '';

  if (!name) {
    return { error: 'SCHEDULE_NAME_REQUIRED', message: 'Schedule name is required.' };
  }

  if (!isTaskTypeKey(taskType)) {
    return { error: 'TASK_TYPE_INVALID', message: 'Unsupported task_type.' };
  }

  if (!isScheduleModeKey(scheduleMode)) {
    return { error: 'SCHEDULE_MODE_INVALID', message: 'Unsupported schedule_mode.' };
  }

  const payloadTemplate = readObject(body.payload_template);
  const payloadError = validateTaskPayload(taskType, payloadTemplate);

  if (payloadError) {
    return { error: 'PAYLOAD_TEMPLATE_INVALID', message: payloadError };
  }

  return {
    value: {
      id: normalizeUuid(body.id),
      name,
      task_type: taskType,
      schedule_mode: scheduleMode,
      request_config_id: normalizeUuid(body.request_config_id),
      is_enabled: typeof body.is_enabled === 'boolean' ? body.is_enabled : true,
      schedule_config: readObject(body.schedule_config),
      payload_template: payloadTemplate,
    } satisfies ScheduleMutation,
  };
}

async function saveSchedule(app: FastifyInstance, body: Record<string, unknown>) {
  const parsed = parseScheduleMutation(body);
  if ('error' in parsed) {
    throw new Error(`${parsed.error}:${parsed.message}`);
  }

  const value = parsed.value;
  if (value.id) {
    const [row] = await app.db.write
      .update(TaskSchedules)
      .set({
        name: value.name,
        task_type: value.task_type,
        schedule_mode: value.schedule_mode,
        request_config_id: value.request_config_id,
        is_enabled: value.is_enabled,
        schedule_config: value.schedule_config,
        payload_template: value.payload_template,
        updated_time: new Date(),
      })
      .where(eq(TaskSchedules.id, value.id))
      .returning();

    if (!row) {
      throw new Error('SCHEDULE_NOT_FOUND:Schedule not found.');
    }

    return row;
  }

  const [row] = await app.db.write
    .insert(TaskSchedules)
    .values({
      name: value.name,
      task_type: value.task_type,
      schedule_mode: value.schedule_mode,
      request_config_id: value.request_config_id,
      is_enabled: value.is_enabled,
      schedule_config: value.schedule_config,
      payload_template: value.payload_template,
      next_run_time: new Date(),
    })
    .returning();

  if (!row) {
    throw new Error('SCHEDULE_CREATE_FAILED:Unable to create schedule.');
  }

  return row;
}

export function registerManagementTaskScheduleRoutes(app: FastifyInstance): void {
  app.post(
    '/api/management/tasks/schedules',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      try {
        return {
          ok: true,
          data: serializeSchedule(await saveSchedule(app, request.body as Record<string, unknown>)),
        };
      } catch (error) {
        return sendTaskError(reply, error);
      }
    },
  );

  app.post(
    '/api/management/tasks/schedules/:scheduleId/toggle',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      const scheduleID = normalizeUuid((request.params as { scheduleId?: string }).scheduleId);
      if (!scheduleID) {
        return sendManagementError(
          reply,
          400,
          'INVALID_SCHEDULE_ID',
          'scheduleId must be a valid UUID.',
        );
      }

      const schedule = await loadScheduleByID(app, scheduleID);
      if (!schedule) {
        return sendManagementError(reply, 404, 'SCHEDULE_NOT_FOUND', 'Schedule not found.');
      }

      const [row] = await app.db.write
        .update(TaskSchedules)
        .set({ is_enabled: !schedule.is_enabled, updated_time: new Date() })
        .where(eq(TaskSchedules.id, scheduleID))
        .returning();

      return { ok: true, data: serializeSchedule(row ?? schedule) };
    },
  );

  app.post(
    '/api/management/tasks/schedules/:scheduleId/run',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      const scheduleID = normalizeUuid((request.params as { scheduleId?: string }).scheduleId);
      if (!scheduleID) {
        return sendManagementError(
          reply,
          400,
          'INVALID_SCHEDULE_ID',
          'scheduleId must be a valid UUID.',
        );
      }

      const schedule = await loadScheduleByID(app, scheduleID);
      if (!schedule) {
        return sendManagementError(reply, 404, 'SCHEDULE_NOT_FOUND', 'Schedule not found.');
      }

      const payloadError = validateTaskPayload(
        schedule.task_type,
        schedule.payload_template as Record<string, unknown>,
      );
      if (payloadError) {
        return sendManagementError(reply, 422, 'PAYLOAD_TEMPLATE_INVALID', payloadError);
      }

      return {
        ok: true,
        data: await enqueueJob(app, {
          schedule_id: schedule.id,
          task_type: schedule.task_type,
          trigger_source: 'MANUAL',
          payload: schedule.payload_template as Record<string, unknown>,
        }),
      };
    },
  );

  app.delete(
    '/api/management/tasks/schedules/:scheduleId',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      const scheduleID = normalizeUuid((request.params as { scheduleId?: string }).scheduleId);
      if (!scheduleID) {
        return sendManagementError(
          reply,
          400,
          'INVALID_SCHEDULE_ID',
          'scheduleId must be a valid UUID.',
        );
      }

      const rows = await app.db.write
        .delete(TaskSchedules)
        .where(eq(TaskSchedules.id, scheduleID))
        .returning({ id: TaskSchedules.id });
      if (rows.length === 0) {
        return sendManagementError(reply, 404, 'SCHEDULE_NOT_FOUND', 'Schedule not found.');
      }

      return { ok: true, data: rows[0] };
    },
  );
}
