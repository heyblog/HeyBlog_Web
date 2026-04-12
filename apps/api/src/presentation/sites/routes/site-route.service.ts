import { Sites } from '@zhblogs/db';

import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { SiteLookupInput } from '../dto/site-request.dto';

const SUBMISSION_LIMIT = 20;
const SUBMISSION_WINDOW_MS = 10 * 60 * 1000;
const submissionAttempts = new Map<string, number[]>();

export function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  fields?: string[],
  details?: Record<string, unknown>,
) {
  return reply.code(statusCode).send({
    ok: false,
    error: {
      code,
      message,
      ...(fields?.length ? { fields } : {}),
      ...(details ?? {}),
    },
  });
}

export async function enforceSubmissionRateLimit(request: FastifyRequest, reply: FastifyReply) {
  const now = Date.now();
  const key = request.ip || 'unknown';
  const cutoff = now - SUBMISSION_WINDOW_MS;
  const recentAttempts = (submissionAttempts.get(key) ?? []).filter(
    (timestamp) => timestamp > cutoff,
  );

  if (recentAttempts.length >= SUBMISSION_LIMIT) {
    return sendApiError(
      reply,
      429,
      'RATE_LIMITED',
      'Too many submission attempts from the current IP, please try again later.',
    );
  }

  recentAttempts.push(now);
  submissionAttempts.set(key, recentAttempts);
}

export async function loadSiteLookupTarget(app: FastifyInstance, payload: SiteLookupInput) {
  const whereClause = payload.site_id
    ? and(eq(Sites.id, payload.site_id), eq(Sites.is_show, true))
    : payload.bid
      ? and(eq(Sites.bid, payload.bid), eq(Sites.is_show, true))
      : and(eq(Sites.url, payload.url ?? ''), eq(Sites.is_show, true));

  const [site] = await app.db.read
    .select({
      site_id: Sites.id,
      bid: Sites.bid,
      name: Sites.name,
      url: Sites.url,
    })
    .from(Sites)
    .where(whereClause)
    .limit(1);

  return site ?? null;
}
