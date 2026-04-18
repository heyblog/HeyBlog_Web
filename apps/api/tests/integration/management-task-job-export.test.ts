import { Jobs, SiteCheckRuns, TaskSchedules } from '@zhblogs/db';

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

describe('management task job export', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('exports current job detail as excel workbook', async () => {
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
                        schedule_id: '22222222-2222-4222-8222-222222222222',
                        task_type: 'SITE_CHECK',
                        trigger_source: 'SCHEDULE',
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
                        schedule_id: '22222222-2222-4222-8222-222222222222',
                        task_type: 'SITE_CHECK',
                        trigger_source: 'SCHEDULE',
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

        if (table === TaskSchedules) {
          return {
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                {
                  id: '22222222-2222-4222-8222-222222222222',
                  name: 'Site Check Schedule',
                  task_type: 'SITE_CHECK',
                  schedule_mode: 'INTERVAL',
                  request_config_id: null,
                  is_enabled: true,
                  schedule_config: { interval_seconds: 1800 },
                  payload_template: {
                    target: { kind: 'SITE', site_id: 'site-1' },
                    options: { run_content_validation: true, run_global_check: true },
                  },
                  next_run_time: new Date('2026-04-15T01:00:00.000Z'),
                  last_run_time: new Date('2026-04-15T00:00:00.000Z'),
                  created_time: new Date('2026-04-14T00:00:00.000Z'),
                  updated_time: new Date('2026-04-15T00:00:00.000Z'),
                },
              ]),
            })),
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
                  content_validation_status: 'PASSED',
                  content_validation_payload: { score: 100 },
                  probe_summary: [
                    {
                      region: 'CN',
                      result: 'SUCCESS',
                      status_code: 200,
                      response_time_ms: 123,
                      duration_ms: 180,
                      content_verified: true,
                    },
                  ],
                  response_time_ms: 123,
                  duration_ms: 180,
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
      url: '/api/management/tasks/jobs/11111111-1111-4111-8111-111111111111/export.xls',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/vnd.ms-excel');
    expect(response.headers['content-disposition']).toContain(
      'task-job-11111111-1111-4111-8111-111111111111.xls',
    );
    expect(response.body).toContain('Worksheet ss:Name="summary"');
    expect(response.body).toContain('Worksheet ss:Name="schedule"');
    expect(response.body).toContain('Worksheet ss:Name="site_check_runs"');
    expect(response.body).toContain('Worksheet ss:Name="site_check_probes"');
    expect(response.body).toContain('Worksheet ss:Name="content_validation"');
  });
});
