import { afterEach, describe, expect, it, vi } from 'vitest';

import { enqueueJob, requeueJobs } from '@/application/jobs/usecase/job-queue.usecase';
import { createTestApp } from '@tests/create-test-app';

describe('jobs service', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('enqueues SITE_CHECK with target payload', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();
    let insertedValues: Record<string, unknown> | undefined;

    app.db.write.insert = vi.fn(() => ({
      values: vi.fn((row: Record<string, unknown>) => {
        insertedValues = row;
        return {
          returning: vi.fn(async () => [
            {
              id: 'job-created-id',
              status: 'PENDING',
              trigger_source: 'MANUAL',
            },
          ]),
        };
      }),
    })) as unknown as typeof app.db.write.insert;

    const result = await enqueueJob(app, {
      task_type: 'SITE_CHECK',
      trigger_source: 'MANUAL',
      payload: {
        target: {
          kind: 'SITE',
          site_id: '11111111-1111-4111-8111-111111111111',
        },
        options: {
          run_content_validation: true,
        },
      },
    });

    expect(insertedValues).toMatchObject({
      task_type: 'SITE_CHECK',
      trigger_source: 'MANUAL',
      retry_sequence: 0,
      payload: {
        target: {
          kind: 'SITE',
          site_id: '11111111-1111-4111-8111-111111111111',
        },
      },
    });
    expect(result).toEqual({
      job_id: 'job-created-id',
      status: 'PENDING',
      trigger_source: 'MANUAL',
    });
  });

  it('rejects SITE_CHECK payload when target is missing', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();

    await expect(
      enqueueJob(app, {
        task_type: 'SITE_CHECK',
        trigger_source: 'MANUAL',
        payload: {},
      }),
    ).rejects.toThrow('PAYLOAD_VIOLATION:target.kind must be SITE, SITE_LIST or ALL_VISIBLE.');
  });

  it('rejects RSS_FETCH payload when feed_mode is invalid', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();

    await expect(
      enqueueJob(app, {
        task_type: 'RSS_FETCH',
        trigger_source: 'MANUAL',
        payload: {
          target: {
            kind: 'SITE',
            site_id: '11111111-1111-4111-8111-111111111111',
          },
          options: {
            feed_mode: 'LATEST_ONLY',
          },
        },
      }),
    ).rejects.toThrow('PAYLOAD_VIOLATION:options.feed_mode must be DEFAULT_ONLY or ALL.');
  });

  it('returns zero requeue count for empty ids', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();

    const result = await requeueJobs(app, [], ['FAILED']);
    expect(result).toEqual({ retried_count: 0 });
  });
});
