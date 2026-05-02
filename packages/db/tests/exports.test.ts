import { Jobs, Sites, taskTypeEnum, userRoleEnum, Users } from '@zhblogs/db/schema';
import { siteInsertSchema, taskScheduleInsertSchema, taskTypeSchema } from '@zhblogs/db/zod';

import { describe, expect, it } from 'vitest';

describe('db public exports', () => {
  it('exposes core schema tables and enums through package subpaths', () => {
    expect(Sites.id).toBeDefined();
    expect(Sites.url).toBeDefined();
    expect(Jobs.status).toBeDefined();
    expect(Users.role).toBeDefined();
    expect(taskTypeEnum.enumValues).toContain('SITE_CHECK');
    expect(userRoleEnum.enumValues).toContain('ADMIN');
  });

  it('exposes zod schemas through package subpaths', () => {
    expect(
      siteInsertSchema.safeParse({ name: 'Example', url: 'https://example.com' }).success,
    ).toBe(true);
    expect(
      taskScheduleInsertSchema.safeParse({
        name: 'Site Check',
        task_type: 'SITE_CHECK',
        schedule_mode: 'INTERVAL',
        schedule_config: { interval_seconds: 60 },
        payload_template: { target: { kind: 'ALL_VISIBLE' } },
      }).success,
    ).toBe(true);
    expect(taskTypeSchema.safeParse('UNKNOWN_TASK').success).toBe(false);
  });
});
