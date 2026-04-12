import type { FastifyReply, FastifyRequest } from 'fastify';

import { hasManagementPermission } from '@/domain/auth/service/auth-role.service';
import { AuthError } from '@/domain/auth/types/auth.types';

export type ManagementPermissionKey =
  | 'feedback.review'
  | 'taxonomy.manage'
  | 'site.manage'
  | 'task.manage'
  | 'log.read';

export type FeedbackDecision = 'APPROVED' | 'REJECTED';

export function sendManagementError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
) {
  return reply.code(statusCode).send({
    ok: false,
    error: {
      code,
      message,
    },
  });
}

export function requireManagementPermission(permission: ManagementPermissionKey) {
  return async (request: FastifyRequest): Promise<void> => {
    const user = await request.server.auth.getCurrentUser(request);

    if (!hasManagementPermission(user, permission)) {
      throw new AuthError('forbidden', `${permission} required`, 403);
    }
  };
}

export function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function normalizeEnumFilter<T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
): T | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  return allowedValues.includes(normalized as T) ? (normalized as T) : null;
}

export function normalizeBooleanFilter(value: string | undefined): boolean | null {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
}

export function normalizePagination(page: number, pageSize: number, totalItems: number) {
  const normalizedPageSize = Math.min(50, Math.max(1, pageSize));
  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const normalizedPage = Math.min(totalPages, Math.max(1, page));

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalItems,
    totalPages,
  };
}
