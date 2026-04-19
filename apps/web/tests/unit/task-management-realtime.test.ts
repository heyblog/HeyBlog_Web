import { describe, expect, it } from 'vitest';

import { buildTaskManagementApiPath } from '@/application/management/task-management.browser';
import { handleTaskManagementStreamRequest } from '@/application/management/task-management.server-handler';

describe('task management transport helpers', () => {
  it('builds same-origin management api paths by default', () => {
    expect(buildTaskManagementApiPath('/api/management/tasks/catalog')).toBe(
      '/api/management/tasks/catalog',
    );
  });

  it('returns 410 for the removed task stream endpoint', async () => {
    const response = await handleTaskManagementStreamRequest(
      new Request('http://127.0.0.1:9101/api/management/tasks/stream?job_id=job-1'),
    );

    expect(response.status).toBe(410);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: 'TASK_STREAM_REMOVED',
        message: 'Task realtime stream has been removed from the refactored task system.',
      },
    });
  });
});
