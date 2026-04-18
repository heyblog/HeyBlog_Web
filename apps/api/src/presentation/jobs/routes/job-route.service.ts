import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  fields?: string[],
) {
  return reply.code(statusCode).send({
    ok: false,
    error: {
      code,
      message,
      ...(fields ? { fields } : {}),
    },
  });
}

export function ensureInternalToken(request: FastifyRequest, app: FastifyInstance) {
  const token = String(request.headers['x-internal-token'] ?? '').trim();
  return token.length > 0 && token === app.config.API_INTERNAL_TOKEN;
}

export function parseEnqueueError(reply: FastifyReply, error: unknown) {
  if (!(error instanceof Error)) {
    return sendError(reply, 503, 'STORAGE_UNAVAILABLE', 'Unable to enqueue jobs right now.');
  }

  if (error.message.startsWith('POLICY_VIOLATION:')) {
    return sendError(
      reply,
      422,
      'POLICY_VIOLATION',
      error.message.replace('POLICY_VIOLATION:', ''),
    );
  }

  if (error.message.startsWith('PAYLOAD_VIOLATION:')) {
    return sendError(
      reply,
      422,
      'PAYLOAD_VIOLATION',
      error.message.replace('PAYLOAD_VIOLATION:', ''),
    );
  }

  if (error.message.startsWith('DUPLICATE_JOB:')) {
    return sendError(reply, 409, 'DUPLICATE_JOB', error.message);
  }

  return sendError(reply, 503, 'STORAGE_UNAVAILABLE', 'Unable to enqueue jobs right now.');
}
