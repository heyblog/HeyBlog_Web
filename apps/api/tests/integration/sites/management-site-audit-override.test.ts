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

describe('management site audit override routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('forbids manual edits to read-only fields through snapshot_override', async () => {
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
            id: MANAGEMENT_TEST_IDS.auditId,
            action: 'UPDATE',
            status: 'PENDING',
            site_id: MANAGEMENT_TEST_IDS.siteId,
            submit_reason: 'update site info',
            submitter_email: 'author@example.com',
            notify_by_email: false,
            current_snapshot: buildManagedSiteSnapshot(),
            proposed_snapshot: buildManagedSiteSnapshot({
              recommend: true,
            }),
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/management/site-audits/${MANAGEMENT_TEST_IDS.auditId}/review`,
      payload: {
        decision: 'APPROVED',
        reviewer_comment: 'adjust source',
        snapshot_override: buildManagedSiteSnapshot({
          from: ['TRAVELLINGS'],
          recommend: true,
        }),
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'SITE_FIELD_FORBIDDEN',
        message: 'Read-only site fields cannot be modified manually: from.',
      },
    });
  });

  it('allows ADMIN snapshot_override for editable site fields and stores override details on the original audit', async () => {
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
            id: MANAGEMENT_TEST_IDS.auditId,
            action: 'UPDATE',
            status: 'PENDING',
            site_id: MANAGEMENT_TEST_IDS.siteId,
            submit_reason: 'fix metadata',
            submitter_email: 'author@example.com',
            notify_by_email: false,
            current_snapshot: buildManagedSiteSnapshot(),
            proposed_snapshot: buildManagedSiteSnapshot({
              recommend: true,
            }),
          },
        ],
      },
      {
        table: Sites,
        rows: [],
      },
      ...createManagedSiteSnapshotSteps({
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
          where: vi.fn(() => {
            if (table === SiteAudits) {
              return {
                returning: vi.fn(async () => [
                  {
                    id: MANAGEMENT_TEST_IDS.auditId,
                    action: 'UPDATE',
                    status: 'APPROVED',
                    site_id: MANAGEMENT_TEST_IDS.siteId,
                    submitter_email: 'author@example.com',
                    notify_by_email: false,
                    reviewer_comment: 'set status',
                    current_snapshot: buildManagedSiteSnapshot(),
                    proposed_snapshot: buildManagedSiteSnapshot({
                      recommend: true,
                    }),
                  },
                ]),
              };
            }

            return Promise.resolve();
          }),
        };
      }),
    })) as unknown as typeof app.db.write.update;

    app.db.write.delete = vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })) as unknown as typeof app.db.write.delete;

    app.db.write.insert = vi.fn((table: unknown) => ({
      values: vi.fn(async (values) => {
        capturedInserts.push({ table, values });
      }),
    })) as unknown as typeof app.db.write.insert;

    const response = await app.inject({
      method: 'POST',
      url: `/api/management/site-audits/${MANAGEMENT_TEST_IDS.auditId}/review`,
      payload: {
        decision: 'APPROVED',
        reviewer_comment: 'set status',
        snapshot_override: buildManagedSiteSnapshot({
          recommend: true,
          status: 'ERROR',
        }),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        audit_id: MANAGEMENT_TEST_IDS.auditId,
        action: 'UPDATE',
        status: 'APPROVED',
        site_id: MANAGEMENT_TEST_IDS.siteId,
      },
    });

    expect(capturedUpdates[0]).toMatchObject({
      table: Sites,
      values: expect.objectContaining({
        status: 'ERROR',
        recommend: true,
      }),
    });
    expect(capturedInserts).toEqual([]);
    const persistedAuditUpdate = capturedUpdates.find((entry) => {
      const record = entry as { table: unknown; values: Record<string, unknown> };
      return record.table === SiteAudits && 'review_override_snapshot' in record.values;
    });

    expect(persistedAuditUpdate).toMatchObject({
      table: SiteAudits,
      values: expect.objectContaining({
        diff: expect.arrayContaining([
          expect.objectContaining({
            field: 'recommend',
            before: false,
            after: true,
          }),
          expect.objectContaining({
            field: 'status',
            before: 'OK',
            after: 'ERROR',
          }),
        ]),
        review_override_snapshot: expect.objectContaining({
          recommend: true,
          status: 'ERROR',
        }),
        review_override_diff: expect.arrayContaining([
          expect.objectContaining({
            field: 'status',
            before: 'OK',
            after: 'ERROR',
          }),
        ]),
      }),
    });
  });

  it('stores CREATE override details on the original audit when ADMIN adjusts the submitted snapshot', async () => {
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
            id: MANAGEMENT_TEST_IDS.auditId,
            action: 'CREATE',
            status: 'PENDING',
            site_id: null,
            submit_reason: 'submit new site',
            submitter_email: 'author@example.com',
            notify_by_email: false,
            current_snapshot: null,
            proposed_snapshot: {
              name: 'Example Blog',
              url: 'https://example.com',
              sign: 'Original sign',
              from: ['WEB_SUBMIT'],
              is_show: true,
              recommend: false,
            },
          },
        ],
      },
      {
        table: Sites,
        rows: [],
      },
      ...createManagedSiteSnapshotSteps({
        id: MANAGEMENT_TEST_IDS.createdSiteId,
        bid: null,
        sign: 'Adjusted sign',
      }),
    ]);

    const capturedUpdates: unknown[] = [];
    const capturedInserts: unknown[] = [];

    app.db.write.update = vi.fn((table: unknown) => ({
      set: vi.fn((values) => {
        capturedUpdates.push({ table, values });
        return {
          where: vi.fn(() => {
            if (table === SiteAudits) {
              return {
                returning: vi.fn(async () => [
                  {
                    id: MANAGEMENT_TEST_IDS.auditId,
                    action: 'CREATE',
                    status: 'APPROVED',
                    site_id: MANAGEMENT_TEST_IDS.createdSiteId,
                    submitter_email: 'author@example.com',
                    notify_by_email: false,
                    reviewer_comment: 'adjust imported sign',
                    current_snapshot: null,
                    proposed_snapshot: {
                      name: 'Example Blog',
                      url: 'https://example.com',
                      sign: 'Original sign',
                      from: ['WEB_SUBMIT'],
                      is_show: true,
                      recommend: false,
                    },
                  },
                ]),
              };
            }

            return Promise.resolve();
          }),
        };
      }),
    })) as unknown as typeof app.db.write.update;

    app.db.write.delete = vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })) as unknown as typeof app.db.write.delete;

    app.db.write.insert = vi.fn((table: unknown) => ({
      values: vi.fn((values) => {
        capturedInserts.push({ table, values });

        if (table === Sites) {
          return {
            returning: vi.fn(async () => [{ id: MANAGEMENT_TEST_IDS.createdSiteId }]),
          };
        }

        return Promise.resolve();
      }),
    })) as unknown as typeof app.db.write.insert;

    const response = await app.inject({
      method: 'POST',
      url: `/api/management/site-audits/${MANAGEMENT_TEST_IDS.auditId}/review`,
      payload: {
        decision: 'APPROVED',
        reviewer_comment: 'adjust imported sign',
        snapshot_override: {
          name: 'Example Blog',
          url: 'https://example.com',
          sign: 'Adjusted sign',
          from: ['WEB_SUBMIT'],
          is_show: true,
          recommend: false,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        audit_id: MANAGEMENT_TEST_IDS.auditId,
        action: 'CREATE',
        status: 'APPROVED',
        site_id: MANAGEMENT_TEST_IDS.createdSiteId,
      },
    });

    expect(capturedInserts[0]).toMatchObject({
      table: Sites,
      values: expect.objectContaining({
        name: 'Example Blog',
        sign: 'Adjusted sign',
      }),
    });
    expect(capturedInserts).toHaveLength(1);
    const persistedAuditUpdate = capturedUpdates.find((entry) => {
      const record = entry as { table: unknown; values: Record<string, unknown> };
      return record.table === SiteAudits && 'review_override_snapshot' in record.values;
    });

    expect(persistedAuditUpdate).toMatchObject({
      table: SiteAudits,
      values: expect.objectContaining({
        current_snapshot: null,
        proposed_snapshot: expect.objectContaining({
          sign: 'Original sign',
        }),
        diff: expect.arrayContaining([
          expect.objectContaining({
            field: 'sign',
            before: null,
            after: 'Adjusted sign',
          }),
        ]),
        review_override_snapshot: expect.objectContaining({
          sign: 'Adjusted sign',
        }),
        review_override_diff: expect.arrayContaining([
          expect.objectContaining({
            field: 'sign',
            before: 'Original sign',
            after: 'Adjusted sign',
          }),
        ]),
      }),
    });
  });
});
