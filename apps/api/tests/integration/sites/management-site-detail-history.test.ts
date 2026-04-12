import { SiteAudits } from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockReadSelect } from '@tests/fixtures/db-mocks';

import {
  BASE_MANAGED_SITE_SNAPSHOT,
  createManagedSiteSnapshotSteps,
  MANAGEMENT_TEST_IDS,
  mockManagementUser,
} from './site-test.helpers';

describe('management site detail routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('returns snapshot and approved history for managed site details', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();
    mockManagementUser(app, 'site.manage');

    mockReadSelect(app, [
      ...createManagedSiteSnapshotSteps(),
      {
        table: SiteAudits,
        rows: [
          {
            id: MANAGEMENT_TEST_IDS.auditId,
            action: 'UPDATE',
            status: 'APPROVED',
            submitter_name: 'Alice',
            submit_reason: 'sync recommend flag',
            reviewer_comment: null,
            diff: [
              {
                field: 'recommend',
                before: false,
                after: true,
              },
            ],
            created_time: new Date('2026-04-09T10:00:00.000Z'),
            reviewed_time: new Date('2026-04-09T10:01:00.000Z'),
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/management/sites/${MANAGEMENT_TEST_IDS.siteId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        snapshot: BASE_MANAGED_SITE_SNAPSHOT,
        history: [
          {
            id: MANAGEMENT_TEST_IDS.auditId,
            action: 'UPDATE',
            status: 'APPROVED',
            operator_name: 'Alice',
            submit_reason: 'sync recommend flag',
            reviewer_comment: null,
            change_summary: '修改 推荐站点',
            created_time: '2026-04-09T10:00:00.000Z',
            reviewed_time: '2026-04-09T10:01:00.000Z',
          },
        ],
      },
    });
  });
});
