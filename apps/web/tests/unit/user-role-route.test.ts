import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST as rolePost } from '@/pages/management/users/[userId]/role';
import { getApiBaseUrl } from '@tests/setup/env';

import {
  createRoleContext,
  createRoleRequest,
  managedUserFixture,
} from './user-authorization-routes.helpers';

describe('management user role route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns JSON success payload for role updates', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: managedUserFixture,
          }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await rolePost(createRoleContext(createRoleRequest('grant-admin')));

    expect(fetchMock).toHaveBeenCalledWith(
      `${getApiBaseUrl()}/api/management/users/${managedUserFixture.id}/grant-admin`,
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: 'role_granted',
      target: managedUserFixture.id,
      redirect: null,
      message: '',
      data: managedUserFixture,
    });
  });

  it('returns JSON even when the request prefers html', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: true,
              data: managedUserFixture,
            }),
          ),
      ),
    );

    const response = await rolePost(
      createRoleContext(createRoleRequest('revoke-admin', 'text/html')),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      ok: true,
      status: 'role_revoked',
      target: managedUserFixture.id,
      redirect: null,
      message: '',
      data: managedUserFixture,
    });
  });

  it('returns JSON unauthorized payload for role updates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { message: 'expired' },
            }),
            { status: 401 },
          ),
      ),
    );

    const response = await rolePost(createRoleContext(createRoleRequest('grant-admin')));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: 'unauthorized',
      target: managedUserFixture.id,
      redirect: '/login?next=%2Fmanagement%2Fusers',
      message: '登录状态已过期，请重新登录。',
      data: null,
    });
  });

  it('returns JSON error payload for forbidden role updates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                message: '  Permission denied for this action.  ',
              },
            }),
            { status: 403 },
          ),
      ),
    );

    const response = await rolePost(createRoleContext(createRoleRequest('revoke-admin')));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      code: 'role_update_failed',
      target: managedUserFixture.id,
      redirect: null,
      message: 'Permission denied for this action.',
      data: null,
    });
  });

  it('rejects invalid role requests with a 400 response', async () => {
    const response = await rolePost(createRoleContext(createRoleRequest('invalid-intent')));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: 'invalid_role_request',
      target: managedUserFixture.id,
      redirect: null,
      message: '角色授权请求无效，请刷新后重试。',
      data: null,
    });
  });
});
