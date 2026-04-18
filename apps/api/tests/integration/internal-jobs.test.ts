import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEST_CONFIG, TEST_HEADERS } from '@tests/config';
import { createTestApp } from '@tests/create-test-app';

describe('internal jobs routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('rejects requests without internal token', async () => {
    app = createTestApp({
      disableExternalServices: true,
      envOverrides: {
        API_INTERNAL_TOKEN: TEST_CONFIG.API_INTERNAL_TOKEN,
      },
    });

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/internal/jobs',
      payload: {
        task_type: 'SITE_CHECK',
        trigger_source: 'MANUAL',
        payload: {
          target: {
            kind: 'SITE',
            site_id: '11111111-1111-4111-8111-111111111111',
          },
        },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid internal token.',
      },
    });
  });

  it('creates a job through internal enqueue endpoint', async () => {
    app = createTestApp({
      disableExternalServices: true,
      envOverrides: {
        API_INTERNAL_TOKEN: TEST_CONFIG.API_INTERNAL_TOKEN,
      },
    });

    await app.ready();

    let insertedValues: Record<string, unknown> | undefined;

    app.db.write.insert = vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        insertedValues = values;
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

    const response = await app.inject({
      method: 'POST',
      url: '/api/internal/jobs',
      headers: {
        [TEST_HEADERS.internalToken]: TEST_CONFIG.API_INTERNAL_TOKEN,
      },
      payload: {
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
      },
    });

    expect(response.statusCode).toBe(200);
    expect(insertedValues).toMatchObject({
      task_type: 'SITE_CHECK',
      trigger_source: 'MANUAL',
    });
    expect(response.json()).toEqual({
      ok: true,
      data: {
        job_id: 'job-created-id',
        status: 'PENDING',
        trigger_source: 'MANUAL',
      },
    });
  });

  it('rejects invalid SITE_CHECK target payload', async () => {
    app = createTestApp({
      disableExternalServices: true,
      envOverrides: {
        API_INTERNAL_TOKEN: TEST_CONFIG.API_INTERNAL_TOKEN,
      },
    });

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/internal/jobs',
      headers: {
        [TEST_HEADERS.internalToken]: TEST_CONFIG.API_INTERNAL_TOKEN,
      },
      payload: {
        task_type: 'SITE_CHECK',
        trigger_source: 'MANUAL',
        payload: {
          target: {
            kind: 'SITE',
            site_id: 'invalid-uuid',
          },
        },
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'PAYLOAD_VIOLATION',
        message: 'target.site_id must be a valid UUID.',
      },
    });
  });
});
