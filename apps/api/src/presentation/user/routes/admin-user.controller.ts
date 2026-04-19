import { MANAGEMENT_PERMISSION_KEYS } from '@zhblogs/db';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import { canManageUsers } from '@/domain/auth/service/auth-role.service';
import { AuthError } from '@/domain/auth/types/auth.types';

const requireUserManager = async (request: FastifyRequest): Promise<void> => {
  const user = await request.server.auth.getCurrentUser(request);

  if (!canManageUsers(user)) {
    throw new AuthError('forbidden', 'user.manage required', 403);
  }
};

const managedUserSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    nickname: { type: 'string' },
    avatarUrl: { type: ['string', 'null'] },
    role: { type: 'string' },
    permissions: { type: 'array', items: { type: 'string' } },
    isActive: { type: 'boolean' },
    isVerified: { type: 'boolean' },
    hasPassword: { type: 'boolean' },
    hasGithub: { type: 'boolean' },
    authVersion: { type: 'number' },
    adminGrantedBy: { type: ['string', 'null'] },
    adminGrantedTime: { type: ['string', 'null'] },
    createdTime: { type: ['string', 'null'] },
    lastLoginTime: { type: ['string', 'null'] },
  },
  required: [
    'id',
    'email',
    'nickname',
    'avatarUrl',
    'role',
    'permissions',
    'isActive',
    'isVerified',
    'hasPassword',
    'hasGithub',
    'authVersion',
    'adminGrantedBy',
    'adminGrantedTime',
    'createdTime',
    'lastLoginTime',
  ],
} as const;

const managedUserEnvelopeSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: managedUserSchema,
  },
  required: ['ok', 'data'],
} as const;

const managedUserListEnvelopeSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: {
      type: 'array',
      items: managedUserSchema,
    },
  },
  required: ['ok', 'data'],
} as const;

const paramsSchema = {
  type: 'object',
  properties: {
    userId: { type: 'string', format: 'uuid' },
  },
  required: ['userId'],
} as const;

const permissionsBodySchema = {
  type: 'object',
  properties: {
    permissions: {
      type: 'array',
      items: {
        type: 'string',
        enum: [...MANAGEMENT_PERMISSION_KEYS],
      },
      uniqueItems: true,
    },
  },
  required: ['permissions'],
} as const;

export function registerAdminUserRoutes(app: FastifyInstance): void {
  app.get(
    '/api/management/users',
    {
      preHandler: requireUserManager,
      schema: {
        response: {
          200: managedUserListEnvelopeSchema,
        },
      },
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    async () => ({
      ok: true,
      data: await app.auth.listManagedUsers(),
    }),
  );

  app.post<{ Params: { userId: string } }>(
    '/api/management/users/:userId/grant-admin',
    {
      preHandler: requireUserManager,
      schema: {
        params: paramsSchema,
        response: {
          200: managedUserEnvelopeSchema,
        },
      },
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (request) => {
      const actor = await app.auth.getCurrentUser(request);
      const data = await app.auth.grantAdminRole(actor, request.params.userId);

      return {
        ok: true,
        data,
      };
    },
  );

  app.post<{ Params: { userId: string } }>(
    '/api/management/users/:userId/revoke-admin',
    {
      preHandler: requireUserManager,
      schema: {
        params: paramsSchema,
        response: {
          200: managedUserEnvelopeSchema,
        },
      },
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (request) => {
      const actor = await app.auth.getCurrentUser(request);
      const data = await app.auth.revokeAdminRole(actor, request.params.userId);

      return {
        ok: true,
        data,
      };
    },
  );

  app.put<{ Params: { userId: string }; Body: { permissions: string[] } }>(
    '/api/management/users/:userId/permissions',
    {
      preHandler: requireUserManager,
      schema: {
        params: paramsSchema,
        body: permissionsBodySchema,
        response: {
          200: managedUserEnvelopeSchema,
        },
      },
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (request) => {
      const actor = await app.auth.getCurrentUser(request);
      const data = await app.auth.updateUserPermissions(
        actor,
        request.params.userId,
        request.body.permissions as (typeof MANAGEMENT_PERMISSION_KEYS)[number][],
      );

      return {
        ok: true,
        data,
      };
    },
  );
}
