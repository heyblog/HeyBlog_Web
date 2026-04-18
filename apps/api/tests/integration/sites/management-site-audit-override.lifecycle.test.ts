import { Jobs, SiteAudits } from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockReadSelect } from '@tests/fixtures/db-mocks';

import {
  buildManagedSiteSnapshot,
  createManagedSiteSnapshotSteps,
  MANAGEMENT_TEST_IDS,
  mockManagementUser,
} from './site-test.helpers';

describe('management site audit override lifecycle routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('enqueues lifecycle event jobs for RESTORE approvals', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();
    mockManagementUser(app, 'site_audit.review');

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [
          {
            id: MANAGEMENT_TEST_IDS.auditId,
            action: 'RESTORE',
            status: 'PENDING',
            site_id: MANAGEMENT_TEST_IDS.siteId,
            submit_reason: 'restore site',
            submitter_email: 'author@example.com',
            notify_by_email: false,
            current_snapshot: buildManagedSiteSnapshot({
              is_show: false,
              reason: 'manual hidden',
            }),
            proposed_snapshot: buildManagedSiteSnapshot({
              is_show: true,
              reason: null,
            }),
          },
        ],
      },
      ...createManagedSiteSnapshotSteps({
        is_show: true,
        reason: null,
      }),
    ]);

    const capturedInserts: unknown[] = [];
    app.db.write.update = vi.fn((table: unknown) => ({
      set: vi.fn(() => ({
        where: vi.fn(() => {
          if (table === SiteAudits) {
            return {
              returning: vi.fn(async () => [
                {
                  id: MANAGEMENT_TEST_IDS.auditId,
                  action: 'RESTORE',
                  status: 'APPROVED',
                  site_id: MANAGEMENT_TEST_IDS.siteId,
                  submitter_email: 'author@example.com',
                  notify_by_email: false,
                  reviewer_comment: 'restore approved',
                  current_snapshot: buildManagedSiteSnapshot({
                    is_show: false,
                    reason: 'manual hidden',
                  }),
                  proposed_snapshot: buildManagedSiteSnapshot({
                    is_show: true,
                    reason: null,
                  }),
                },
              ]),
            };
          }

          return Promise.resolve();
        }),
      })),
    })) as unknown as typeof app.db.write.update;

    app.db.write.delete = vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })) as unknown as typeof app.db.write.delete;

    app.db.write.insert = vi.fn((table: unknown) => ({
      values: vi.fn((values) => {
        capturedInserts.push({ table, values });

        if (table === Jobs) {
          return {
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn(async () => [
                {
                  id: crypto.randomUUID(),
                  status: 'PENDING',
                  trigger_source: 'EVENT',
                },
              ]),
            })),
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
        reviewer_comment: 'restore approved',
      },
    });

    expect(response.statusCode).toBe(200);

    const jobInsertRecords = capturedInserts.filter((entry) => {
      const record = entry as { table: unknown; values: Record<string, unknown> };
      return record.table === Jobs;
    }) as Array<{ table: unknown; values: Record<string, unknown> }>;
    expect(jobInsertRecords.length).toBeGreaterThanOrEqual(2);
    expect(jobInsertRecords.map((entry) => entry.values.task_type)).toEqual(
      expect.arrayContaining(['SITE_CHECK', 'RSS_FETCH']),
    );
    expect(jobInsertRecords.map((entry) => entry.values.payload)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({
            action: 'RESTORE',
            source: 'site-audit',
          }),
        }),
      ]),
    );
  });
});
