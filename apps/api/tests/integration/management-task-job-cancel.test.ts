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

describe('management task cancel route', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('cancels pending jobs immediately', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();
    mockTaskManagerUser(app);

    app.db.read.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ id: 'job-1', status: 'PENDING', error_code: null }]),
        })),
      })),
    })) as unknown as typeof app.db.read.select;

    app.db.write.update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [
            { id: 'job-1', status: 'CANCELED', error_code: 'MANUAL_CANCELED' },
          ]),
        })),
      })),
    })) as unknown as typeof app.db.write.update;

    const response = await app.inject({
      method: 'POST',
      url: '/api/management/tasks/jobs/11111111-1111-4111-8111-111111111111/cancel',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        id: 'job-1',
        status: 'CANCELED',
        error_code: 'MANUAL_CANCELED',
      },
    });
  });

  it('marks running jobs as cancel requested for cooperative stop', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();
    mockTaskManagerUser(app);

    app.db.read.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ id: 'job-1', status: 'RUNNING', error_code: null }]),
        })),
      })),
    })) as unknown as typeof app.db.read.select;

    app.db.write.update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [
            { id: 'job-1', status: 'RUNNING', error_code: 'CANCEL_REQUESTED' },
          ]),
        })),
      })),
    })) as unknown as typeof app.db.write.update;

    const response = await app.inject({
      method: 'POST',
      url: '/api/management/tasks/jobs/11111111-1111-4111-8111-111111111111/cancel',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        id: 'job-1',
        status: 'RUNNING',
        error_code: 'CANCEL_REQUESTED',
        cancel_requested: true,
      },
    });
  });
});
