import {
  ProgramTechnologyStacks,
  SiteArchitectures,
  SiteAudits,
  Sites,
  SiteTags,
} from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockReadSelect, mockWriteInsertSuccess } from '@tests/fixtures/db-mocks';

describe('site submission routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('submits a site delete request as a pending soft-delete audit', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    const siteId = '11111111-1111-4111-8111-111111111111';

    mockReadSelect(app, [
      {
        table: Sites,
        rows: [
          {
            id: siteId,
            bid: 'example-blog',
            name: 'Example Blog',
            url: 'https://example.com',
            sign: 'Old sign',
            icon_base64: null,
            feed: [],
            from: ['WEB_SUBMIT'],
            classification_status: 'COMPLETE',
            sitemap: null,
            link_page: null,
            access_scope: 'BOTH',
            status: 'OK',
            is_show: true,
            recommend: false,
            reason: null,
          },
        ],
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
        table: ProgramTechnologyStacks,
        rows: [],
      },
      {
        table: SiteAudits,
        rows: [],
      },
    ]);

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-delete-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${siteId}/deletions`,
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Site is retired.',
        notify_by_email: true,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        audit_id: 'audit-delete-id',
        action: 'DELETE',
        status: 'PENDING',
        site_id: siteId,
      },
    });

    expect(writeMock.getInsertedValues()).toMatchObject({
      site_id: siteId,
      action: 'DELETE',
      proposed_snapshot: {
        is_show: false,
        reason: 'Site is retired.',
      },
      current_snapshot: {
        is_show: true,
        reason: null,
      },
    });

    expect(writeMock.getInsertedValues()).toMatchObject({
      diff: expect.arrayContaining([
        expect.objectContaining({
          field: 'is_show',
          before: true,
          after: false,
        }),
        expect.objectContaining({
          field: 'reason',
          before: null,
          after: 'Site is retired.',
        }),
      ]),
    });
  });

  it('stores nullable submitter info for delete submissions without contact fields', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    const siteId = '11111111-1111-4111-8111-111111111111';

    mockReadSelect(app, [
      {
        table: Sites,
        rows: [
          {
            id: siteId,
            bid: 'example-blog',
            name: 'Example Blog',
            url: 'https://example.com',
            sign: 'Old sign',
            icon_base64: null,
            feed: [],
            from: ['WEB_SUBMIT'],
            classification_status: 'COMPLETE',
            sitemap: null,
            link_page: null,
            access_scope: 'BOTH',
            status: 'OK',
            is_show: true,
            recommend: false,
            reason: null,
          },
        ],
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
        table: ProgramTechnologyStacks,
        rows: [],
      },
      {
        table: SiteAudits,
        rows: [],
      },
    ]);

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-delete-null-contact-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${siteId}/deletions`,
      payload: {
        submitter_name: null,
        submitter_email: null,
        submit_reason: 'Site is retired.',
        notify_by_email: false,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(writeMock.getInsertedValues()).toMatchObject({
      submitter_name: null,
      submitter_email: null,
    });
  });

  it('returns the active pending submission when the site already has an unfinished audit', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    const siteId = '11111111-1111-4111-8111-111111111111';

    mockReadSelect(app, [
      {
        table: Sites,
        rows: [
          {
            id: siteId,
            bid: 'example-blog',
            name: 'Example Blog',
            url: 'https://example.com',
            sign: 'Old sign',
            icon_base64: null,
            feed: [],
            from: ['WEB_SUBMIT'],
            classification_status: 'COMPLETE',
            sitemap: null,
            link_page: null,
            access_scope: 'BOTH',
            status: 'OK',
            is_show: true,
            recommend: false,
            reason: null,
          },
        ],
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
        table: ProgramTechnologyStacks,
        rows: [],
      },
      {
        table: SiteAudits,
        rows: [
          {
            id: 'audit-delete-pending-id',
          },
        ],
      },
      {
        table: SiteAudits,
        rows: [
          {
            id: 'audit-delete-pending-id',
            action: 'DELETE',
            status: 'PENDING',
            site_id: siteId,
            created_time: new Date('2026-04-12T08:45:00.000Z'),
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${siteId}/deletions`,
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Site is retired.',
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
          audit_id: 'audit-delete-pending-id',
          action: 'DELETE',
          status: 'PENDING',
          created_time: '2026-04-12T08:45:00.000Z',
          site_id: siteId,
        },
      },
    });
  });
});
