import { Sites, SiteTags, TagDefinitions } from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockReadSelect } from '@tests/fixtures/db-mocks';

import {
  BASE_MANAGED_SITE_ROW,
  MANAGEMENT_TEST_IDS,
  mockManagementUser,
} from './site-test.helpers';

describe('management site list routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('lists managed sites in a paginated response envelope', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();
    mockManagementUser(app, 'site.manage');

    mockReadSelect(app, [
      {
        table: Sites,
        rows: [{ total: 12 }],
      },
      {
        table: Sites,
        rows: [
          {
            id: MANAGEMENT_TEST_IDS.siteId,
            bid: BASE_MANAGED_SITE_ROW.bid,
            name: BASE_MANAGED_SITE_ROW.name,
            url: BASE_MANAGED_SITE_ROW.url,
            classification_status: BASE_MANAGED_SITE_ROW.classification_status,
            access_scope: BASE_MANAGED_SITE_ROW.access_scope,
            status: BASE_MANAGED_SITE_ROW.status,
            is_show: BASE_MANAGED_SITE_ROW.is_show,
            recommend: BASE_MANAGED_SITE_ROW.recommend,
            update_time: BASE_MANAGED_SITE_ROW.update_time,
          },
        ],
      },
      {
        table: SiteTags,
        rows: [
          {
            site_id: MANAGEMENT_TEST_IDS.siteId,
            tag_id: 'main-tag-id',
          },
        ],
      },
      {
        table: TagDefinitions,
        rows: [
          {
            id: 'main-tag-id',
            name: '技术',
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/management/sites?q=Example&classification_status=COMPLETE&page=2&pageSize=5',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        items: [
          {
            id: MANAGEMENT_TEST_IDS.siteId,
            bid: 'example-bid',
            name: 'Example Blog',
            url: 'https://example.com',
            classification_status: 'COMPLETE',
            access_scope: 'BOTH',
            status: 'OK',
            is_show: true,
            recommend: false,
            main_tag_id: 'main-tag-id',
            main_tag_name: '技术',
            update_time: '2026-04-09T09:00:00.000Z',
          },
        ],
        pagination: {
          page: 2,
          pageSize: 5,
          totalItems: 12,
          totalPages: 3,
        },
      },
    });
  });
});
