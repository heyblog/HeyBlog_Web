import {
  REQUEST_RETRY_STRATEGY_KEYS,
  RequestConfigs,
  type RequestRetryStrategyKey,
  TASK_TYPE_KEYS,
  type TaskTypeKey,
} from '@zhblogs/db';

import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  normalizeBooleanFilter,
  normalizeEnumFilter,
  requireManagementPermission,
  sendManagementError,
} from './management-route.shared';
import { normalizeUuid } from './management-task.shared';

type RequestConfigQuery = {
  task_type?: string;
  is_enabled?: string;
};

type RequestConfigMutation = {
  id: string | null;
  name: string;
  task_type: TaskTypeKey;
  user_agent: string;
  timeout_ms: number;
  retry_max: number;
  retry_strategy: RequestRetryStrategyKey;
  retry_base_delay_ms: number;
  retry_max_delay_ms: number;
  backoff_factor: number;
  jitter_ratio: number;
  wait_between_requests_ms: number;
  follow_redirects: boolean;
  default_headers: Record<string, string>;
  is_enabled: boolean;
};

function serializeRequestConfig(row: typeof RequestConfigs.$inferSelect) {
  return {
    ...row,
    default_headers: row.default_headers ?? {},
    created_time: row.created_time.toISOString(),
    updated_time: row.updated_time.toISOString(),
  };
}

function readPositiveInteger(value: unknown, fallback: number, allowZero = false) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = Math.floor(parsed);
  if (allowZero) {
    return Math.max(0, normalized);
  }

  return Math.max(1, normalized);
}

function readHeaderMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (headers, [key, headerValue]) => {
      const normalizedKey = key.trim();
      const normalizedValue = typeof headerValue === 'string' ? headerValue.trim() : '';

      if (normalizedKey && normalizedValue) {
        headers[normalizedKey] = normalizedValue;
      }

      return headers;
    },
    {},
  );
}

function parseRequestConfig(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const taskType = normalizeEnumFilter(
    typeof body.task_type === 'string' ? body.task_type.trim() : undefined,
    TASK_TYPE_KEYS,
  );
  const retryStrategy = normalizeEnumFilter(
    typeof body.retry_strategy === 'string' ? body.retry_strategy.trim() : undefined,
    REQUEST_RETRY_STRATEGY_KEYS,
  );
  const userAgent = typeof body.user_agent === 'string' ? body.user_agent.trim() : '';

  if (!name) {
    return { error: 'REQUEST_CONFIG_NAME_REQUIRED', message: 'Request config name is required.' };
  }

  if (!taskType) {
    return { error: 'REQUEST_CONFIG_TASK_TYPE_INVALID', message: 'Unsupported task_type.' };
  }

  if (!retryStrategy) {
    return {
      error: 'REQUEST_CONFIG_RETRY_STRATEGY_INVALID',
      message: 'Unsupported retry_strategy.',
    };
  }

  if (!userAgent) {
    return { error: 'REQUEST_CONFIG_USER_AGENT_REQUIRED', message: 'user_agent is required.' };
  }

  return {
    value: {
      id: normalizeUuid(body.id),
      name,
      task_type: taskType,
      user_agent: userAgent,
      timeout_ms: readPositiveInteger(body.timeout_ms, 20_000),
      retry_max: readPositiveInteger(body.retry_max, 2, true),
      retry_strategy: retryStrategy,
      retry_base_delay_ms: readPositiveInteger(body.retry_base_delay_ms, 1_000, true),
      retry_max_delay_ms: readPositiveInteger(body.retry_max_delay_ms, 10_000, true),
      backoff_factor: readPositiveInteger(body.backoff_factor, 2),
      jitter_ratio: readPositiveInteger(body.jitter_ratio, 0, true),
      wait_between_requests_ms: readPositiveInteger(body.wait_between_requests_ms, 0, true),
      follow_redirects: body.follow_redirects !== false,
      default_headers: readHeaderMap(body.default_headers),
      is_enabled: body.is_enabled !== false,
    } satisfies RequestConfigMutation,
  };
}

async function saveRequestConfig(app: FastifyInstance, body: Record<string, unknown>) {
  const parsed = parseRequestConfig(body);
  if ('error' in parsed) {
    throw new Error(`${parsed.error}:${parsed.message}`);
  }

  const value = parsed.value;
  if (value.id) {
    const [row] = await app.db.write
      .update(RequestConfigs)
      .set({
        name: value.name,
        task_type: value.task_type,
        user_agent: value.user_agent,
        timeout_ms: value.timeout_ms,
        retry_max: value.retry_max,
        retry_strategy: value.retry_strategy,
        retry_base_delay_ms: value.retry_base_delay_ms,
        retry_max_delay_ms: value.retry_max_delay_ms,
        backoff_factor: value.backoff_factor,
        jitter_ratio: value.jitter_ratio,
        wait_between_requests_ms: value.wait_between_requests_ms,
        follow_redirects: value.follow_redirects,
        default_headers: value.default_headers,
        is_enabled: value.is_enabled,
        updated_time: new Date(),
      })
      .where(eq(RequestConfigs.id, value.id))
      .returning();

    if (!row) {
      throw new Error('REQUEST_CONFIG_NOT_FOUND:Request config not found.');
    }

    return row;
  }

  const { id: _unusedId, ...insertValues } = value;
  const [row] = await app.db.write.insert(RequestConfigs).values(insertValues).returning();
  if (!row) {
    throw new Error('REQUEST_CONFIG_CREATE_FAILED:Unable to create request config.');
  }

  return row;
}

function sendRequestConfigError(reply: Parameters<typeof sendManagementError>[0], error: unknown) {
  if (!(error instanceof Error)) {
    return sendManagementError(
      reply,
      500,
      'REQUEST_CONFIG_OPERATION_FAILED',
      'Request config operation failed.',
    );
  }

  const [code, message] = error.message.split(':', 2);
  if (code && message) {
    const statusCode = code.endsWith('_NOT_FOUND') ? 404 : code.includes('INVALID') ? 422 : 400;
    return sendManagementError(reply, statusCode, code, message);
  }

  return sendManagementError(reply, 500, 'REQUEST_CONFIG_OPERATION_FAILED', error.message);
}

export function registerManagementTaskRequestConfigRoutes(app: FastifyInstance): void {
  app.get(
    '/api/management/tasks/request-configs',
    { preHandler: requireManagementPermission('task.manage') },
    async (request) => {
      const query = request.query as RequestConfigQuery;
      const taskType = normalizeEnumFilter(query.task_type, TASK_TYPE_KEYS);
      const isEnabled = normalizeBooleanFilter(query.is_enabled);
      const rows = await app.db.read
        .select()
        .from(RequestConfigs)
        .where(
          and(
            taskType ? eq(RequestConfigs.task_type, taskType) : undefined,
            typeof isEnabled === 'boolean' ? eq(RequestConfigs.is_enabled, isEnabled) : undefined,
          ),
        )
        .orderBy(desc(RequestConfigs.updated_time));

      return {
        ok: true,
        data: rows.map(serializeRequestConfig),
      };
    },
  );

  app.get(
    '/api/management/tasks/request-configs/:configId',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      const configID = normalizeUuid((request.params as { configId?: string }).configId);
      if (!configID) {
        return sendManagementError(
          reply,
          400,
          'INVALID_REQUEST_CONFIG_ID',
          'configId must be a valid UUID.',
        );
      }

      const [row] = await app.db.read
        .select()
        .from(RequestConfigs)
        .where(eq(RequestConfigs.id, configID))
        .limit(1);
      if (!row) {
        return sendManagementError(
          reply,
          404,
          'REQUEST_CONFIG_NOT_FOUND',
          'Request config not found.',
        );
      }

      return { ok: true, data: serializeRequestConfig(row) };
    },
  );

  app.post(
    '/api/management/tasks/request-configs',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      try {
        return {
          ok: true,
          data: serializeRequestConfig(
            await saveRequestConfig(app, request.body as Record<string, unknown>),
          ),
        };
      } catch (error) {
        return sendRequestConfigError(reply, error);
      }
    },
  );

  app.post(
    '/api/management/tasks/request-configs/:configId/toggle',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      const configID = normalizeUuid((request.params as { configId?: string }).configId);
      if (!configID) {
        return sendManagementError(
          reply,
          400,
          'INVALID_REQUEST_CONFIG_ID',
          'configId must be a valid UUID.',
        );
      }

      const [current] = await app.db.read
        .select()
        .from(RequestConfigs)
        .where(eq(RequestConfigs.id, configID))
        .limit(1);
      if (!current) {
        return sendManagementError(
          reply,
          404,
          'REQUEST_CONFIG_NOT_FOUND',
          'Request config not found.',
        );
      }

      const [row] = await app.db.write
        .update(RequestConfigs)
        .set({ is_enabled: !current.is_enabled, updated_time: new Date() })
        .where(eq(RequestConfigs.id, configID))
        .returning();

      return { ok: true, data: serializeRequestConfig(row ?? current) };
    },
  );

  app.delete(
    '/api/management/tasks/request-configs/:configId',
    { preHandler: requireManagementPermission('task.manage') },
    async (request, reply) => {
      const configID = normalizeUuid((request.params as { configId?: string }).configId);
      if (!configID) {
        return sendManagementError(
          reply,
          400,
          'INVALID_REQUEST_CONFIG_ID',
          'configId must be a valid UUID.',
        );
      }

      try {
        const rows = await app.db.write
          .delete(RequestConfigs)
          .where(eq(RequestConfigs.id, configID))
          .returning({ id: RequestConfigs.id });
        if (rows.length === 0) {
          return sendManagementError(
            reply,
            404,
            'REQUEST_CONFIG_NOT_FOUND',
            'Request config not found.',
          );
        }

        return { ok: true, data: rows[0] };
      } catch {
        return sendManagementError(
          reply,
          409,
          'REQUEST_CONFIG_DELETE_CONFLICT',
          'Request config is still referenced by schedules or runs.',
        );
      }
    },
  );
}
