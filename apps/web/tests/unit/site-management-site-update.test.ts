import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST as siteUpdatePost } from '@/pages/management/sites/[siteId]/update';
import { getApiBaseUrl, getWebBaseUrl } from '@tests/setup/env';

import { createSiteUpdateContext, siteId } from './site-management-routes.helpers';

describe('management site update route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns JSON success payload for site updates', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: { site_id: siteId },
          }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await siteUpdatePost(
      createSiteUpdateContext(
        new Request(`${getWebBaseUrl()}/management/sites/${siteId}/update`, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            snapshot: {
              name: 'Example Blog',
              url: 'https://example.com',
              is_show: true,
            },
            comment: 'admin update',
          }),
        }),
      ),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `${getApiBaseUrl()}/api/management/sites/${siteId}`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          snapshot: {
            name: 'Example Blog',
            url: 'https://example.com',
            is_show: true,
          },
          comment: 'admin update',
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: 'site_updated',
      target: siteId,
      redirect: null,
      message: '',
      data: { site_id: siteId },
    });
  });

  it('returns JSON unauthorized payload for site updates', async () => {
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

    const response = await siteUpdatePost(
      createSiteUpdateContext(
        new Request(`${getWebBaseUrl()}/management/sites/${siteId}/update`, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            snapshot: {
              name: 'Example Blog',
              url: 'https://example.com',
            },
          }),
        }),
      ),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: 'unauthorized',
      target: siteId,
      redirect: `/login?next=${encodeURIComponent(`/management/sites/${siteId}`)}`,
      message: '登录状态已过期，请重新登录。',
      data: null,
    });
  });

  it('returns JSON error payload for forbidden site updates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                message: '  Read-only site fields cannot be modified manually: reason.  ',
              },
            }),
            { status: 403 },
          ),
      ),
    );

    const response = await siteUpdatePost(
      createSiteUpdateContext(
        new Request(`${getWebBaseUrl()}/management/sites/${siteId}/update`, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            snapshot: {
              name: 'Example Blog',
              url: 'https://example.com',
              reason: 'manual override',
            },
          }),
        }),
      ),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      code: 'site_update_failed',
      target: siteId,
      redirect: null,
      message: 'Read-only site fields cannot be modified manually: reason.',
      data: null,
    });
  });
});
