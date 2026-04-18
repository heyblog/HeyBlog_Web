import { Jobs, type JobStatusKey } from '@zhblogs/db';

import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { requeueJobs } from '@/application/jobs/usecase';

import { requireManagementPermission, sendManagementError } from './management-route.shared';
import {
  loadRetryChainByJob,
  loadRunsByJobID,
  normalizeUuid,
  serializeJob,
} from './management-task.shared';
import { buildTaskJobExportWorkbook } from './management-task-job-export';

const REQUEUE_JOB_STATUSES: JobStatusKey[] = ['FAILED', 'CANCELED'];
const TERMINAL_JOB_STATUSES: JobStatusKey[] = ['SUCCEEDED', 'FAILED', 'CANCELED'];
const CANCEL_REQUESTED_ERROR_CODE = 'CANCEL_REQUESTED';
const CANCEL_REQUESTED_MESSAGE = 'Cancellation requested from management panel.';
const MANUAL_CANCELED_MESSAGE = 'Canceled from management panel.';

export function registerManagementTaskJobRoutes(app: FastifyInstance): void {
  app.get(
    '/api/management/tasks/jobs/:jobId/export.xls',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      const jobID = normalizeUuid((request.params as { jobId?: string }).jobId);
      if (!jobID) {
        return sendManagementError(reply, 400, 'INVALID_JOB_ID', 'jobId must be a valid UUID.');
      }

      const [job] = await app.db.read.select().from(Jobs).where(eq(Jobs.id, jobID)).limit(1);
      if (!job) {
        return sendManagementError(reply, 404, 'JOB_NOT_FOUND', 'Job not found.');
      }

      const workbook = await buildTaskJobExportWorkbook(app, job);
      const filename = `task-job-${job.id}.xls`;

      reply.header('cache-control', 'no-store');
      reply.header('content-disposition', `attachment; filename="${filename}"`);
      reply.header('content-type', 'application/vnd.ms-excel; charset=utf-8');
      return reply.send(workbook);
    },
  );

  app.get(
    '/api/management/tasks/jobs/:jobId',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      const jobID = normalizeUuid((request.params as { jobId?: string }).jobId);
      if (!jobID) {
        return sendManagementError(reply, 400, 'INVALID_JOB_ID', 'jobId must be a valid UUID.');
      }

      const [job] = await app.db.read.select().from(Jobs).where(eq(Jobs.id, jobID)).limit(1);
      if (!job) {
        return sendManagementError(reply, 404, 'JOB_NOT_FOUND', 'Job not found.');
      }

      return {
        ok: true,
        data: {
          ...serializeJob(job),
          ...(await loadRetryChainByJob(app, job)),
          ...(await loadRunsByJobID(app, job)),
        },
      };
    },
  );

  app.post(
    '/api/management/tasks/jobs/:jobId/requeue',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      const jobID = normalizeUuid((request.params as { jobId?: string }).jobId);
      if (!jobID) {
        return sendManagementError(reply, 400, 'INVALID_JOB_ID', 'jobId must be a valid UUID.');
      }

      return {
        ok: true,
        data: await requeueJobs(app, [jobID], REQUEUE_JOB_STATUSES),
      };
    },
  );

  app.post(
    '/api/management/tasks/jobs/:jobId/cancel',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      const jobID = normalizeUuid((request.params as { jobId?: string }).jobId);
      if (!jobID) {
        return sendManagementError(reply, 400, 'INVALID_JOB_ID', 'jobId must be a valid UUID.');
      }

      const [job] = await app.db.read
        .select({
          id: Jobs.id,
          status: Jobs.status,
          error_code: Jobs.error_code,
        })
        .from(Jobs)
        .where(eq(Jobs.id, jobID))
        .limit(1);

      if (!job) {
        return sendManagementError(reply, 404, 'JOB_NOT_FOUND', 'Job not found.');
      }

      if (job.status === 'PENDING') {
        const rows = await app.db.write
          .update(Jobs)
          .set({
            status: 'CANCELED',
            finished_time: new Date(),
            updated_time: new Date(),
            error_code: 'MANUAL_CANCELED',
            error_message: MANUAL_CANCELED_MESSAGE,
          })
          .where(and(eq(Jobs.id, jobID), eq(Jobs.status, 'PENDING')))
          .returning({ id: Jobs.id, status: Jobs.status, error_code: Jobs.error_code });

        if (rows.length === 0) {
          return sendManagementError(
            reply,
            409,
            'JOB_CANCEL_UNAVAILABLE',
            'Only pending or running jobs can be canceled.',
          );
        }

        return { ok: true, data: rows[0] };
      }

      if (job.status === 'RUNNING') {
        const rows = await app.db.write
          .update(Jobs)
          .set({
            updated_time: new Date(),
            error_code: CANCEL_REQUESTED_ERROR_CODE,
            error_message: CANCEL_REQUESTED_MESSAGE,
          })
          .where(and(eq(Jobs.id, jobID), eq(Jobs.status, 'RUNNING')))
          .returning({ id: Jobs.id, status: Jobs.status, error_code: Jobs.error_code });

        if (rows.length === 0) {
          return sendManagementError(
            reply,
            409,
            'JOB_CANCEL_UNAVAILABLE',
            'Only pending or running jobs can be canceled.',
          );
        }

        return {
          ok: true,
          data: {
            ...rows[0],
            cancel_requested: true,
          },
        };
      }

      if (job.error_code === CANCEL_REQUESTED_ERROR_CODE) {
        return sendManagementError(
          reply,
          409,
          'JOB_CANCEL_UNAVAILABLE',
          'The running job is already waiting for cooperative cancellation.',
        );
      }

      return sendManagementError(
        reply,
        409,
        'JOB_CANCEL_UNAVAILABLE',
        'Only pending or running jobs can be canceled.',
      );
    },
  );

  app.delete(
    '/api/management/tasks/jobs/:jobId',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      const jobID = normalizeUuid((request.params as { jobId?: string }).jobId);
      if (!jobID) {
        return sendManagementError(reply, 400, 'INVALID_JOB_ID', 'jobId must be a valid UUID.');
      }

      const rows = await app.db.write
        .delete(Jobs)
        .where(and(eq(Jobs.id, jobID), inArray(Jobs.status, TERMINAL_JOB_STATUSES)))
        .returning({ id: Jobs.id });

      if (rows.length === 0) {
        return sendManagementError(
          reply,
          409,
          'JOB_DELETE_UNAVAILABLE',
          'Only terminal jobs can be deleted.',
        );
      }

      return { ok: true, data: rows[0] };
    },
  );
}
