import { SiteAudits, Sites } from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockReadSelect } from '@tests/fixtures/db-mocks';

import {
  buildManagedSiteSnapshot,
  createManagedSiteSnapshotSteps,
  MANAGEMENT_TEST_IDS,
  mockManagementUser,
} from './site-test.helpers';

describe('management site update routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('forbids manual edits to read-only managed fields in direct edits', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();
    mockManagementUser(app, 'site.manage');

    mockReadSelect(app, createManagedSiteSnapshotSteps());

    const response = await app.inject({
      method: 'PUT',
      url: `/api/management/sites/${MANAGEMENT_TEST_IDS.siteId}`,
      payload: {
        snapshot: buildManagedSiteSnapshot({
          bid: 'new-bid',
        }),
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'SITE_FIELD_FORBIDDEN',
        message: 'Read-only site fields cannot be modified manually: bid.',
      },
    });
  });

  it('allows ADMIN to edit access scope, status, and recommend and writes an approved audit trail', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();
    mockManagementUser(app, 'site.manage');

    mockReadSelect(app, [
      ...createManagedSiteSnapshotSteps(),
      {
        table: Sites,
        rows: [],
      },
      ...createManagedSiteSnapshotSteps({
        access_scope: 'NON_CN_ONLY',
        status: 'ERROR',
        recommend: true,
      }),
    ]);

    const capturedUpdates: unknown[] = [];
    const capturedInserts: unknown[] = [];

    app.db.write.update = vi.fn((table: unknown) => ({
      set: vi.fn((values) => {
        capturedUpdates.push({ table, values });
        return {
          where: vi.fn(async () => undefined),
        };
      }),
    })) as unknown as typeof app.db.write.update;

    app.db.write.delete = vi.fn((table: unknown) => ({
      where: vi.fn(async () => {
        capturedUpdates.push({ table, values: 'deleted' });
      }),
    })) as unknown as typeof app.db.write.delete;

    app.db.write.insert = vi.fn((table: unknown) => ({
      values: vi.fn(async (values) => {
        capturedInserts.push({ table, values });
      }),
    })) as unknown as typeof app.db.write.insert;

    const response = await app.inject({
      method: 'PUT',
      url: `/api/management/sites/${MANAGEMENT_TEST_IDS.siteId}`,
      payload: {
        snapshot: buildManagedSiteSnapshot({
          access_scope: 'NON_CN_ONLY',
          status: 'ERROR',
          recommend: true,
        }),
        comment: 'promote on homepage',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        site_id: MANAGEMENT_TEST_IDS.siteId,
      },
    });

    expect(capturedUpdates[0]).toMatchObject({
      table: Sites,
      values: expect.objectContaining({
        access_scope: 'NON_CN_ONLY',
        status: 'ERROR',
        recommend: true,
      }),
    });
    expect(capturedInserts[0]).toMatchObject({
      table: SiteAudits,
      values: expect.objectContaining({
        site_id: MANAGEMENT_TEST_IDS.siteId,
        action: 'UPDATE',
        status: 'APPROVED',
        submit_reason: 'promote on homepage',
        reviewer_comment: 'promote on homepage',
      }),
    });
  });
});
