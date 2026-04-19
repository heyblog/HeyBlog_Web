import type { FastifyInstance } from 'fastify';

import {
  createPresenceEventHub,
  createPresenceSnapshot,
  formatPresenceComment,
  formatPresenceEvent,
  PRESENCE_ACTIVE_WINDOW_MS,
  PRESENCE_EVENT_NAME,
  PRESENCE_HEARTBEAT_INTERVAL_MS,
  PRESENCE_STREAM_HEARTBEAT_MS,
  readPresenceCount,
  touchPresence,
} from '@/application/presence/usecase/presence.usecase';

const presenceCountDataSchema = {
  type: 'object',
  properties: {
    count: { type: 'number' },
  },
  required: ['count'],
} as const;

const presenceOnlineResponseSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        count: { type: 'number' },
        activeWindowMs: { type: 'number' },
        heartbeatIntervalMs: { type: 'number' },
      },
      required: ['count', 'activeWindowMs', 'heartbeatIntervalMs'],
    },
  },
  required: ['ok', 'data'],
} as const;

const presenceHeartbeatBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    clientId: { type: 'string', minLength: 1 },
  },
  required: ['clientId'],
} as const;

const presenceHeartbeatResponseSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: presenceCountDataSchema,
  },
  required: ['ok', 'data'],
} as const;

const presenceErrorResponseSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    message: { type: 'string' },
  },
  required: ['ok', 'message'],
} as const;

const CLIENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function registerPresenceRoutes(app: FastifyInstance): void {
  const hub = createPresenceEventHub();
  let lastPublishedCount: number | null = null;

  app.get(
    '/api/presence/online',
    {
      schema: {
        tags: ['public'],
        summary: 'Current anonymous online visitor count',
        response: {
          200: presenceOnlineResponseSchema,
          503: presenceErrorResponseSchema,
        },
      },
      config: {
        rateLimit: {
          max: 240,
          timeWindow: '1 minute',
        },
      },
    },
    async (_request, reply) => {
      try {
        const count = await readPresenceCount(app.db.cache);

        reply.header('cache-control', 'no-store');

        return {
          ok: true,
          data: {
            count,
            activeWindowMs: PRESENCE_ACTIVE_WINDOW_MS,
            heartbeatIntervalMs: PRESENCE_HEARTBEAT_INTERVAL_MS,
          },
        };
      } catch (error) {
        app.log.error({ error }, 'failed to read online presence count');

        return reply.code(503).send({
          ok: false,
          message: 'Presence service is temporarily unavailable.',
        });
      }
    },
  );

  app.post(
    '/api/presence/heartbeat',
    {
      schema: {
        tags: ['public'],
        summary: 'Refresh the anonymous visitor heartbeat',
        body: presenceHeartbeatBodySchema,
        response: {
          200: presenceHeartbeatResponseSchema,
          400: presenceErrorResponseSchema,
          503: presenceErrorResponseSchema,
        },
      },
      config: {
        rateLimit: {
          max: 600,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const payload = request.body as { clientId: string };

      if (!CLIENT_ID_PATTERN.test(payload.clientId)) {
        return reply.code(400).send({
          ok: false,
          message: 'clientId must be a valid UUID.',
        });
      }

      try {
        const count = await touchPresence(app.db.cache, payload.clientId);

        reply.header('cache-control', 'no-store');

        if (count !== lastPublishedCount) {
          lastPublishedCount = count;
          hub.publish(createPresenceSnapshot(count));
        }

        return {
          ok: true,
          data: {
            count,
          },
        };
      } catch (error) {
        app.log.error({ error }, 'failed to record presence heartbeat');

        return reply.code(503).send({
          ok: false,
          message: 'Presence service is temporarily unavailable.',
        });
      }
    },
  );

  app.get(
    '/api/presence/stream',
    {
      schema: {
        tags: ['public'],
        summary: 'Anonymous visitor count event stream',
        response: {
          503: presenceErrorResponseSchema,
        },
      },
      config: {
        compress: false,
        rateLimit: {
          max: 120,
          timeWindow: '1 minute',
        },
      },
    },
    (request, reply) => {
      reply.hijack();

      void (async () => {
        try {
          const rawReply = reply.raw;
          const currentCount = await readPresenceCount(app.db.cache);
          const initialSnapshot = createPresenceSnapshot(currentCount);

          rawReply.statusCode = 200;
          rawReply.setHeader('content-type', 'text/event-stream; charset=utf-8');
          rawReply.setHeader('cache-control', 'no-cache, no-store, must-revalidate');
          rawReply.setHeader('connection', 'keep-alive');
          rawReply.setHeader('x-accel-buffering', 'no');
          rawReply.flushHeaders?.();
          rawReply.write(formatPresenceEvent(initialSnapshot));

          const sendSnapshot = (snapshot: { count: number; at: string }) => {
            rawReply.write(formatPresenceEvent(snapshot));
          };

          const stopHeartbeat = setInterval(() => {
            rawReply.write(formatPresenceComment());
          }, PRESENCE_STREAM_HEARTBEAT_MS);

          const unsubscribe = hub.subscribe(sendSnapshot);

          const cleanup = () => {
            clearInterval(stopHeartbeat);
            unsubscribe();
            request.raw.off('close', cleanup);
          };

          request.raw.on('close', cleanup);
        } catch (error) {
          app.log.error({ error }, 'failed to start presence event stream');

          if (!reply.raw.headersSent) {
            reply.raw.statusCode = 503;
            reply.raw.setHeader('content-type', 'application/json; charset=utf-8');
            reply.raw.end(
              JSON.stringify({
                ok: false,
                message: 'Presence service is temporarily unavailable.',
              }),
            );
            return;
          }

          reply.raw.write(
            formatPresenceEvent(createPresenceSnapshot(lastPublishedCount ?? 0)).replace(
              PRESENCE_EVENT_NAME,
              'presence.error',
            ),
          );
          reply.raw.end();
        }
      })();
    },
  );
}
