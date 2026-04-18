import { Jobs, SiteCheckRuns } from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';

function mockTaskManagerUser(app: ReturnType<typeof createTestApp>) {
  app.auth.getCurrentUser = vi.fn(async () => ({
    id: '33333333-3333-4333-8333-333333333333',
    role: 'ADMIN',
    nickname: 'TaskAdmin',
    email: 'task-admin@example.com',
    permissions: ['task.manage'],
  })) as unknown as typeof app.auth.getCurrentUser;
}

describe('management task routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('returns the collapsed task catalog', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();
    mockTaskManagerUser(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/management/tasks/catalog',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        task_types: expect.arrayContaining([
          expect.objectContaining({ key: 'UPSTREAM_SYNC' }),
          expect.objectContaining({ key: 'SITE_CHECK' }),
          expect.objectContaining({ key: 'RSS_FETCH' }),
        ]),
        presets: {
          manual: expect.arrayContaining([
            expect.objectContaining({ task_type: 'SITE_CHECK' }),
            expect.objectContaining({ task_type: 'RSS_FETCH' }),
            expect.objectContaining({ task_type: 'UPSTREAM_SYNC' }),
          ]),
        },
      },
    });
    expect(response.json().data.presets).not.toHaveProperty('schedules');
  });

  it('rejects schedule save when SITE_CHECK payload_template misses target', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();
    mockTaskManagerUser(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/management/tasks/schedules',
      payload: {
        name: 'Invalid Site Check Schedule',
        task_type: 'SITE_CHECK',
        schedule_mode: 'INTERVAL',
        schedule_config: {
          interval_seconds: 1800,
        },
        payload_template: {},
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'PAYLOAD_TEMPLATE_INVALID',
        message: 'target.kind must be SITE, SITE_LIST or ALL_VISIBLE.',
      },
    });
  });

  it('returns job detail with site check runs', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();
    mockTaskManagerUser(app);

    let jobsReadCount = 0;

    app.db.read.select = vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (table === Jobs) {
          return {
            where: vi.fn(() => {
              jobsReadCount += 1;
              return jobsReadCount === 1
                ? {
                    limit: vi.fn(async () => [
                      {
                        id: '11111111-1111-4111-8111-111111111111',
                        schedule_id: null,
                        task_type: 'SITE_CHECK',
                        trigger_source: 'MANUAL',
                        status: 'SUCCEEDED',
                        payload: { target: { kind: 'SITE', site_id: 'site-1' } },
                        result: { success_count: 1 },
                        retry_root_job_id: null,
                        retry_parent_job_id: null,
                        retry_sequence: 0,
                        run_at: new Date('2026-04-15T00:00:00.000Z'),
                        locked_at: null,
                        locked_by: null,
                        heartbeat_time: null,
                        started_time: new Date('2026-04-15T00:00:10.000Z'),
                        finished_time: new Date('2026-04-15T00:00:20.000Z'),
                        error_code: null,
                        error_message: null,
                        created_time: new Date('2026-04-15T00:00:00.000Z'),
                        updated_time: new Date('2026-04-15T00:00:20.000Z'),
                      },
                    ]),
                  }
                : {
                    orderBy: vi.fn(async () => [
                      {
                        id: '11111111-1111-4111-8111-111111111111',
                        schedule_id: null,
                        task_type: 'SITE_CHECK',
                        trigger_source: 'MANUAL',
                        status: 'SUCCEEDED',
                        payload: { target: { kind: 'SITE', site_id: 'site-1' } },
                        result: { success_count: 1 },
                        retry_root_job_id: null,
                        retry_parent_job_id: null,
                        retry_sequence: 0,
                        run_at: new Date('2026-04-15T00:00:00.000Z'),
                        locked_at: null,
                        locked_by: null,
                        heartbeat_time: null,
                        started_time: new Date('2026-04-15T00:00:10.000Z'),
                        finished_time: new Date('2026-04-15T00:00:20.000Z'),
                        error_code: null,
                        error_message: null,
                        created_time: new Date('2026-04-15T00:00:00.000Z'),
                        updated_time: new Date('2026-04-15T00:00:20.000Z'),
                      },
                    ]),
                  };
            }),
          };
        }

        if (table === SiteCheckRuns) {
          return {
            where: vi.fn(() => ({
              orderBy: vi.fn(async () => [
                {
                  id: 'run-1',
                  job_id: '11111111-1111-4111-8111-111111111111',
                  site_id: 'site-1',
                  request_config_id: null,
                  status: 'SUCCEEDED',
                  availability_result: 'SUCCESS',
                  verify_result: 'PASSED',
                  effective_access_scope: 'ALL',
                  derived_access_scope: 'ALL',
                  derived_status: 'OK',
                  check_mode: 'STANDARD',
                  content_validation_status: 'NOT_REQUESTED',
                  content_validation_payload: null,
                  probe_summary: [
                    {
                      region: 'CN',
                      result: 'SUCCESS',
                      status_code: 200,
                    },
                  ],
                  response_time_ms: 120,
                  duration_ms: 200,
                  jitter_ms: 15,
                  final_url: 'https://example.com',
                  error_code: null,
                  error_message: null,
                  started_time: new Date('2026-04-15T00:00:10.000Z'),
                  finished_time: new Date('2026-04-15T00:00:20.000Z'),
                  created_time: new Date('2026-04-15T00:00:20.000Z'),
                },
              ]),
            })),
          };
        }

        throw new Error(`unexpected table: ${String(table)}`);
      }),
    })) as unknown as typeof app.db.read.select;

    const response = await app.inject({
      method: 'GET',
      url: '/api/management/tasks/jobs/11111111-1111-4111-8111-111111111111',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        task_type: 'SITE_CHECK',
        result: {
          success_count: 1,
        },
        retry_chain: [
          expect.objectContaining({
            id: '11111111-1111-4111-8111-111111111111',
            retry_sequence: 0,
          }),
        ],
        site_check_runs: [
          expect.objectContaining({
            id: 'run-1',
            availability_result: 'SUCCESS',
            verify_result: 'PASSED',
          }),
        ],
      },
    });
  });

  it('creates manual SITE_CHECK jobs with explicit options', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();
    mockTaskManagerUser(app);

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
      url: '/api/management/tasks/manual/site-check',
      payload: {
        site_id: '11111111-1111-4111-8111-111111111111',
        run_content_validation: true,
        run_global_check: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(insertedValues).toMatchObject({
      task_type: 'SITE_CHECK',
      payload: {
        target: {
          kind: 'SITE',
          site_id: '11111111-1111-4111-8111-111111111111',
        },
        options: {
          run_content_validation: true,
          run_global_check: true,
          source: 'management-manual',
        },
      },
    });
  });

  it('creates schedules without queue or trigger rule fields', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();
    mockTaskManagerUser(app);

    let insertedValues: Record<string, unknown> | undefined;

    app.db.write.insert = vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        insertedValues = values;
        return {
          returning: vi.fn(async () => [
            {
              id: '22222222-2222-4222-8222-222222222222',
              name: 'RSS schedule',
              task_type: 'RSS_FETCH',
              schedule_mode: 'INTERVAL',
              request_config_id: null,
              is_enabled: true,
              schedule_config: { interval_seconds: 3600 },
              payload_template: { target: { kind: 'ALL_VISIBLE' } },
              next_run_time: new Date('2026-04-15T01:00:00.000Z'),
              last_run_time: null,
              created_time: new Date('2026-04-15T00:00:00.000Z'),
              updated_time: new Date('2026-04-15T00:00:00.000Z'),
            },
          ]),
        };
      }),
    })) as unknown as typeof app.db.write.insert;

    const response = await app.inject({
      method: 'POST',
      url: '/api/management/tasks/schedules',
      payload: {
        name: 'RSS schedule',
        task_type: 'RSS_FETCH',
        schedule_mode: 'INTERVAL',
        schedule_config: {
          interval_seconds: 3600,
        },
        payload_template: {
          target: {
            kind: 'ALL_VISIBLE',
          },
          options: {
            feed_mode: 'DEFAULT_ONLY',
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(insertedValues).toMatchObject({
      name: 'RSS schedule',
      task_type: 'RSS_FETCH',
      schedule_mode: 'INTERVAL',
      payload_template: {
        target: {
          kind: 'ALL_VISIBLE',
        },
      },
    });
    expect(insertedValues).not.toHaveProperty('queue_name');
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        id: '22222222-2222-4222-8222-222222222222',
        task_type: 'RSS_FETCH',
      },
    });
  });
});
