import { expect, vi } from 'vitest';

import type { createTestApp } from '../create-test-app';

export type QueryStep = {
  table: unknown;
  rows: unknown[];
};

export type UpdateStep = {
  table: unknown;
  rows?: unknown[];
};

function createAwaitableRows(rows: unknown[]) {
  const createOffsetChain = () => ({
    limit: vi.fn(async () => rows),
    offset: vi.fn(async () => rows),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  });

  const createLimitChain = () => ({
    offset: vi.fn(async () => rows),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  });

  return {
    limit: vi.fn(async () => rows),
    offset: vi.fn(() => createOffsetChain()),
    orderBy: vi.fn(() => ({
      limit: vi.fn(() => createLimitChain()),
      offset: vi.fn(() => createOffsetChain()),
      then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    })),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
}

export function mockReadSelect(app: ReturnType<typeof createTestApp>, steps: QueryStep[]) {
  const queue = [...steps];

  app.db.read.select = vi.fn(() => ({
    from(table: unknown) {
      const stepIndex = queue.findIndex((step) => step.table === table);
      const step = stepIndex >= 0 ? queue.splice(stepIndex, 1)[0] : undefined;

      if (!step) {
        throw new Error('unexpected read query');
      }

      return {
        where: vi.fn(() => createAwaitableRows(step.rows)),
      };
    },
  })) as unknown as typeof app.db.read.select;
}

export function mockWriteInsertSuccess(
  app: ReturnType<typeof createTestApp>,
  rows: Array<{ id: string; status: string }>,
) {
  let insertedValues: unknown;

  app.db.write.insert = vi.fn(() => ({
    values: vi.fn((values) => {
      insertedValues = values;

      return {
        returning: vi.fn(async () => rows),
      };
    }),
  })) as unknown as typeof app.db.write.insert;

  return {
    getInsertedValues: () => insertedValues,
  };
}

export function mockWriteInsertFailure(app: ReturnType<typeof createTestApp>, error: Error) {
  app.db.write.insert = vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => {
        throw error;
      }),
    })),
  })) as unknown as typeof app.db.write.insert;
}

export function mockWriteUpdateSequence(
  app: ReturnType<typeof createTestApp>,
  steps: UpdateStep[],
) {
  const queue = [...steps];
  const capturedValues: unknown[] = [];

  app.db.write.update = vi.fn((table: unknown) => ({
    set: vi.fn((values) => {
      const step = queue.shift();

      if (!step) {
        throw new Error('unexpected update query');
      }

      expect(step.table).toBe(table);
      capturedValues.push(values);

      return {
        where: vi.fn(() => {
          if (step.rows) {
            return {
              returning: vi.fn(async () => step.rows),
            };
          }

          return Promise.resolve();
        }),
      };
    }),
  })) as unknown as typeof app.db.write.update;

  return {
    getCapturedValues: () => capturedValues,
  };
}
