import { Sites } from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockReadSelect } from '@tests/fixtures/db-mocks';

import { mockSiteUpdateFlowReads, updateFlowSiteId } from './sites-update-flows.helpers';

describe('site update submission error flows', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('returns the active pending submission when the site already has an unfinished update flow', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();

    mockSiteUpdateFlowReads(app, {
      siteOverrides: {
        sitemap: null,
        link_page: null,
      },
      pendingAuditRows: [{ id: 'audit-pending-existing' }],
      activeAuditRows: [
        {
          id: 'audit-pending-existing',
          action: 'UPDATE',
          status: 'PENDING',
          site_id: updateFlowSiteId,
          created_time: new Date('2026-04-12T08:30:00.000Z'),
        },
      ],
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${updateFlowSiteId}/updates`,
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Please refresh the site profile.',
        notify_by_email: false,
        changes: {
          sign: 'New sign',
        },
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'PENDING_AUDIT_EXISTS',
        message: 'There is already a pending submission for the target site.',
        active_submission: {
          audit_id: 'audit-pending-existing',
          action: 'UPDATE',
          status: 'PENDING',
          created_time: '2026-04-12T08:30:00.000Z',
          site_id: updateFlowSiteId,
        },
      },
    });
  });

  it('returns 404 when the update target site does not exist', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();

    mockReadSelect(app, [
      {
        table: Sites,
        rows: [],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${updateFlowSiteId}/updates`,
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Please refresh the site profile.',
        notify_by_email: false,
        changes: {
          sign: 'New sign',
        },
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'SITE_NOT_FOUND',
        message: 'The target site does not exist.',
      },
    });
  });

  it('returns 503 when update audit creation hits a dependency error', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();

    app.db.read.select = vi.fn(() => {
      throw new Error('db unavailable');
    }) as unknown as typeof app.db.read.select;

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${updateFlowSiteId}/updates`,
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Please refresh the site profile.',
        notify_by_email: false,
        changes: {
          sign: 'New sign',
        },
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'DEPENDENCY_ERROR',
        message: 'Unable to persist the site update submission right now.',
      },
    });
  });
});
