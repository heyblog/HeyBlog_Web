import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import fp from 'fastify-plugin';

export const securityPlugin = fp(
  async (app) => {
    await app.register(sensible);
    await app.register(cookie);

    await app.register(cors, {
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        const allowlist = app.config.API_CORS_ORIGINS.split(',')
          .map((entry) => entry.trim())
          .filter(Boolean);

        callback(null, allowlist.includes(origin));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });

    await app.register(helmet, {
      crossOriginResourcePolicy: false,
    });

    await app.register(compress, {
      global: true,
      encodings: ['br', 'gzip', 'deflate'],
    });

    await app.register(rateLimit, {
      global: false,
      max: 120,
      timeWindow: '1 minute',
      keyGenerator: (request) => request.ip,
      errorResponseBuilder: (_request, context) => ({
        ok: false,
        error: 'RATE_LIMITED',
        message: `Rate limit exceeded, retry in ${context.after}`,
      }),
    });
  },
  { name: 'security', dependencies: ['config'] },
);
