import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST as permissionsPost } from '@/pages/management/users/[userId]/permissions';
import { getApiBaseUrl } from '@tests/setup/env';

import {
  createPermissionsContext,
  createPermissionsRequest,
  managedUserFixture,
} from './user-authorization-routes.helpers';

describe('management user permissions route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns JSON success payload for permission updates and de-duplicates permissions', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              ...managedUserFixture,
              permissions: ['feedback.review', 'user.manage'],
            },
          }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await permissionsPost(
      createPermissionsContext(
        createPermissionsRequest(['user.manage', 'feedback.review', 'user.manage']),
      ),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `${getApiBaseUrl()}/api/management/users/${managedUserFixture.id}/permissions`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          permissions: ['user.manage', 'feedback.review'],
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: 'permissions_updated',
      target: managedUserFixture.id,
      redirect: null,
      message: '',
      data: {
        ...managedUserFixture,
        permissions: ['feedback.review', 'user.manage'],
      },
    });
  });

  it('returns JSON conflict payload for permission updates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                message: '  Authorization state changed.  ',
              },
            }),
            { status: 409 },
          ),
      ),
    );

    const response = await permissionsPost(
      createPermissionsContext(createPermissionsRequest(['user.manage'])),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      code: 'permission_update_failed',
      target: managedUserFixture.id,
      redirect: null,
      message: 'Authorization state changed.',
      data: null,
    });
  });

  it('rejects invalid permission requests with a 400 response', async () => {
    const response = await permissionsPost(
      createPermissionsContext(createPermissionsRequest(['not.a.valid.permission'])),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: 'invalid_permissions_request',
      target: managedUserFixture.id,
      redirect: null,
      message: '模块权限请求无效，请刷新后重试。',
      data: null,
    });
  });

  it('rejects malformed managed user ids before proxying the request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await permissionsPost(
      createPermissionsContext(createPermissionsRequest(['user.manage']), 'not-a-uuid'),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
  });
});
