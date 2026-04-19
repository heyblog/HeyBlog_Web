import { describe, expect, it } from 'vitest';

import {
  applyPresetToScheduleForm,
  buildSchedulePayload,
  createEmptyScheduleForm,
} from '@/components/management/tasks/task-management.helpers';

describe('task management helpers', () => {
  it('includes full check only for all-visible site checks', () => {
    const form = createEmptyScheduleForm();
    form.targetKind = 'ALL_VISIBLE';
    form.runFullCheck = true;

    expect(buildSchedulePayload(form)).toMatchObject({
      payload_template: {
        target: { kind: 'ALL_VISIBLE' },
        options: {
          run_full_check: true,
        },
      },
    });

    form.targetKind = 'SITE';
    const payload = buildSchedulePayload(form);
    expect(payload).toMatchObject({
      payload_template: {
        target: { kind: 'SITE' },
      },
    });
    expect(payload).not.toHaveProperty('payload_template.options.run_full_check');
  });

  it('reads full check state from schedule preset', () => {
    const result = applyPresetToScheduleForm(
      {
        payload_template: {
          target: { kind: 'ALL_VISIBLE' },
          options: { run_full_check: true },
        },
      },
      createEmptyScheduleForm(),
    );

    expect(result.runFullCheck).toBe(true);
  });
});
