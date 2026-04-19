import { Jobs } from '@zhblogs/db';

import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

const healthResponseSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    service: { type: 'string' },
    environment: { type: 'string' },
    plugins: {
      type: 'object',
      properties: {
        config: { type: 'boolean' },
        drizzle: { type: 'boolean' },
        cache: { type: 'boolean' },
        security: { type: 'boolean' },
      },
      required: ['config', 'drizzle', 'cache', 'security'],
    },
  },
  required: ['ok', 'service', 'environment', 'plugins'],
} as const;

const dependencyHealthSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    service: { type: 'string' },
    check: { type: 'string' },
  },
  required: ['ok', 'service', 'check'],
} as const;

const workerHealthSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    service: { type: 'string' },
    check: { type: 'string' },
    last_success_time: { type: ['string', 'null'] },
    running_jobs: { type: 'number' },
    pending_jobs: { type: 'number' },
  },
  required: ['ok', 'service', 'check', 'last_success_time', 'running_jobs', 'pending_jobs'],
} as const;

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Application health summary',
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () => ({
      ok: true,
      service: '@zhblogs/api',
      environment: app.config.NODE_ENV,
      plugins: {
        config: Boolean(app.config),
        drizzle: Boolean(app.db.read && app.db.write),
        cache: Boolean(app.db.cache),
        security: true,
      },
    }),
  );

  app.get(
    '/health/db',
    {
      schema: {
        tags: ['health'],
        summary: 'Database dependency health',
        response: {
          200: dependencyHealthSchema,
          503: dependencyHealthSchema,
        },
      },
    },
    async (_request, reply) => {
      if (app.bootstrapOptions.disableExternalServices) {
        return {
          ok: true,
          service: 'database',
          check: 'skipped',
        };
      }

      try {
        await app.db.read.execute(sql`select 1`);
        return {
          ok: true,
          service: 'database',
          check: 'ready',
        };
      } catch (error) {
        app.log.error({ error }, 'database health check failed');
        return reply.code(503).send({
          ok: false,
          service: 'database',
          check: 'failed',
        });
      }
    },
  );

  app.get(
    '/health/cache',
    {
      schema: {
        tags: ['health'],
        summary: 'Cache dependency health',
        response: {
          200: dependencyHealthSchema,
          503: dependencyHealthSchema,
        },
      },
    },
    async (_request, reply) => {
      if (app.bootstrapOptions.disableExternalServices) {
        return {
          ok: true,
          service: 'cache',
          check: 'skipped',
        };
      }

      try {
        await app.db.cache?.ping();
        return {
          ok: true,
          service: 'cache',
          check: 'ready',
        };
      } catch (error) {
        app.log.error({ error }, 'cache health check failed');
        return reply.code(503).send({
          ok: false,
          service: 'cache',
          check: 'failed',
        });
      }
    },
  );

  app.get(
    '/health/worker',
    {
      schema: {
        tags: ['health'],
        summary: 'Worker dependency health',
        response: {
          200: workerHealthSchema,
          503: workerHealthSchema,
        },
      },
    },
    async (_request, reply) => {
      if (app.bootstrapOptions.disableExternalServices) {
        return {
          ok: true,
          service: 'worker',
          check: 'skipped',
          last_success_time: null,
          running_jobs: 0,
          pending_jobs: 0,
        };
      }

      try {
        const [row] = await app.db.read
          .select({
            last_success_time: sql<Date | null>`max(case when ${Jobs.status} = 'SUCCEEDED' then ${Jobs.finished_time} end)`,
            running_jobs: sql<number>`count(*) filter (where ${Jobs.status} = 'RUNNING')`,
            pending_jobs: sql<number>`count(*) filter (where ${Jobs.status} = 'PENDING')`,
          })
          .from(Jobs);
        const lastSuccessTime = row?.last_success_time ?? null;
        const staleThreshold = Date.now() - 60 * 60 * 1000;
        const isHealthy = Boolean(
          lastSuccessTime && new Date(lastSuccessTime).getTime() >= staleThreshold,
        );

        if (!isHealthy) {
          return reply.code(503).send({
            ok: false,
            service: 'worker',
            check: 'stale',
            last_success_time: lastSuccessTime ? new Date(lastSuccessTime).toISOString() : null,
            running_jobs: Number(row?.running_jobs ?? 0),
            pending_jobs: Number(row?.pending_jobs ?? 0),
          });
        }

        return {
          ok: true,
          service: 'worker',
          check: 'ready',
          last_success_time: lastSuccessTime ? new Date(lastSuccessTime).toISOString() : null,
          running_jobs: Number(row?.running_jobs ?? 0),
          pending_jobs: Number(row?.pending_jobs ?? 0),
        };
      } catch (error) {
        app.log.error({ error }, 'worker health check failed');
        return reply.code(503).send({
          ok: false,
          service: 'worker',
          check: 'failed',
          last_success_time: null,
          running_jobs: 0,
          pending_jobs: 0,
        });
      }
    },
  );
}
