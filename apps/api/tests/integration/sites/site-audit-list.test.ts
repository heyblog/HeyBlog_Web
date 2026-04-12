import { SiteAudits } from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockReadSelect } from '@tests/fixtures/db-mocks';

import { mockManagementUser } from './site-test.helpers';

describe('site audit read routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('lists site audits in the paginated management response envelope', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();
    mockManagementUser(app, 'site_audit.review');

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            action: 'CREATE',
            status: 'PENDING',
            site_id: null,
            submitter_name: null,
            submitter_email: null,
            submit_reason: 'Request inclusion for my site.',
            created_time: new Date('2026-04-06T06:00:00.000Z'),
            reviewed_time: null,
            current_snapshot: null,
            proposed_snapshot: {
              name: 'Example Blog',
              url: 'https://example.com',
            },
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/management/site-audits?status=PENDING',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            action: 'CREATE',
            status: 'PENDING',
            site_id: null,
            site_name: 'Example Blog',
            submitter_name: null,
            submitter_email: null,
            submit_reason: 'Request inclusion for my site.',
            created_time: '2026-04-06T06:00:00.000Z',
            reviewed_time: null,
          },
        ],
        pagination: {
          page: 1,
          pageSize: 1,
          totalItems: 1,
          totalPages: 1,
        },
      },
    });
  });
});
