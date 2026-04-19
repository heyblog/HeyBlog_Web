import { type POST as permissionsPost } from '@/pages/management/users/[userId]/permissions';
import { type POST as rolePost } from '@/pages/management/users/[userId]/role';
import { getWebBaseUrl } from '@tests/setup/env';

export const managedUserFixture = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'alice@example.com',
  nickname: 'Alice',
  avatarUrl: null,
  role: 'ADMIN',
  permissions: ['user.manage'],
  isActive: true,
  isVerified: true,
  hasPassword: true,
  hasGithub: false,
  authVersion: 1,
  adminGrantedBy: '22222222-2222-4222-8222-222222222222',
  adminGrantedTime: '2026-04-09T10:00:00.000Z',
  createdTime: '2026-01-01T10:00:00.000Z',
  lastLoginTime: '2026-04-09T10:00:00.000Z',
};

export const createRoleContext = (request: Request, userId = managedUserFixture.id) =>
  ({
    request,
    params: {
      userId,
    },
  }) as unknown as Parameters<typeof rolePost>[0];

export const createPermissionsContext = (request: Request, userId = managedUserFixture.id) =>
  ({
    request,
    params: {
      userId,
    },
  }) as unknown as Parameters<typeof permissionsPost>[0];

export const createRoleRequest = (
  intent: string,
  accept = 'application/json',
  extraHeaders: Record<string, string> = {},
): Request => {
  const body = new FormData();
  body.set('intent', intent);

  return new Request(`${getWebBaseUrl()}/management/users/${managedUserFixture.id}/role`, {
    method: 'POST',
    headers: {
      accept,
      ...extraHeaders,
    },
    body,
  });
};

export const createPermissionsRequest = (
  permissions: string[],
  accept = 'application/json',
  extraHeaders: Record<string, string> = {},
): Request => {
  const body = new FormData();

  for (const permission of permissions) {
    body.append('permissions', permission);
  }

  return new Request(`${getWebBaseUrl()}/management/users/${managedUserFixture.id}/permissions`, {
    method: 'POST',
    headers: {
      accept,
      ...extraHeaders,
    },
    body,
  });
};
