import { SiteArchitectures, SiteAudits, Sites, SiteTags } from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockReadSelect, mockWriteInsertSuccess } from '@tests/fixtures/db-mocks';

describe('site restore submission routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;
  const siteId = '11111111-1111-4111-8111-111111111111';
  const hiddenSiteRow = {
    id: siteId,
    bid: 'archived-example',
    name: 'Archived Example',
    url: 'https://example.com',
    sign: 'Old sign',
    icon_base64: null,
    feed: [],
    from: ['WEB_SUBMIT'],
    classification_status: 'COMPLETE',
    sitemap: null,
    link_page: null,
    access_scope: 'BOTH',
    status: 'ERROR',
    is_show: false,
    recommend: false,
    reason: 'temporarily offline',
  };

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('returns the hidden site as a restore target', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: Sites,
        rows: [
          {
            site_id: siteId,
            bid: hiddenSiteRow.bid,
            name: hiddenSiteRow.name,
            url: hiddenSiteRow.url,
            reason: hiddenSiteRow.reason,
            is_show: false,
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/sites/${siteId}/restorations/target`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        site_id: siteId,
        bid: 'archived-example',
        name: 'Archived Example',
        url: 'https://example.com',
        reason: 'temporarily offline',
      },
    });
  });

  it('submits a restore request as a pending audit', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: Sites,
        rows: [
          {
            site_id: siteId,
            bid: hiddenSiteRow.bid,
            name: hiddenSiteRow.name,
            url: hiddenSiteRow.url,
            reason: hiddenSiteRow.reason,
            is_show: false,
          },
        ],
      },
      {
        table: Sites,
        rows: [hiddenSiteRow],
      },
      {
        table: SiteTags,
        rows: [],
      },
      {
        table: SiteArchitectures,
        rows: [],
      },
      {
        table: SiteAudits,
        rows: [],
      },
      {
        table: Sites,
        rows: [],
      },
    ]);

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-restore-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${siteId}/restorations`,
      payload: {
        site_id: siteId,
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        restore_reason: 'Site is back online.',
        notify_by_email: true,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        audit_id: 'audit-restore-id',
        action: 'RESTORE',
        status: 'PENDING',
        site_id: siteId,
      },
    });
    expect(writeMock.getInsertedValues()).toMatchObject({
      site_id: siteId,
      action: 'RESTORE',
      submit_reason: 'Site is back online.',
      submitter_name: 'Alice',
      submitter_email: 'alice@example.com',
      current_snapshot: expect.objectContaining({
        is_show: false,
        reason: 'temporarily offline',
      }),
      proposed_snapshot: expect.objectContaining({
        is_show: true,
        reason: null,
      }),
    });
  });

  it('returns the active pending submission when a restore request already exists', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: Sites,
        rows: [
          {
            site_id: siteId,
            bid: hiddenSiteRow.bid,
            name: hiddenSiteRow.name,
            url: hiddenSiteRow.url,
            reason: hiddenSiteRow.reason,
            is_show: false,
          },
        ],
      },
      {
        table: Sites,
        rows: [hiddenSiteRow],
      },
      {
        table: SiteTags,
        rows: [],
      },
      {
        table: SiteArchitectures,
        rows: [],
      },
      {
        table: SiteAudits,
        rows: [
          {
            id: 'audit-restore-pending-id',
            action: 'RESTORE',
            status: 'PENDING',
            site_id: siteId,
            created_time: new Date('2026-04-12T09:15:00.000Z'),
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${siteId}/restorations`,
      payload: {
        site_id: siteId,
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        restore_reason: 'Site is back online.',
        notify_by_email: false,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'PENDING_AUDIT_EXISTS',
        message: 'There is already a pending submission for the target site.',
        active_submission: {
          audit_id: 'audit-restore-pending-id',
          action: 'RESTORE',
          status: 'PENDING',
          created_time: '2026-04-12T09:15:00.000Z',
          site_id: siteId,
        },
      },
    });
  });
});
