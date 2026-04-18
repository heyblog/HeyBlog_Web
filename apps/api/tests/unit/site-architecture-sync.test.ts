import {
  Programs,
  ProgramTechnologyStacks,
  SiteArchitectures,
  SiteTags,
  TagDefinitions,
  TechnologyCatalogs,
} from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  syncSiteArchitecture,
  syncSiteTags,
} from '@/application/sites/usecase/site-architecture-sync.usecase';
import { ensureTechnologyIdsExist } from '@/infrastructure/sites/db/site.repository';

type QueryStep = {
  table: unknown;
  rows: unknown[];
};

type DeleteStep = {
  table: unknown;
};

type InsertStep = {
  table: unknown;
  rows?: unknown[];
};

function createAwaitableRows(rows: unknown[]) {
  return {
    limit: vi.fn(async () => rows),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
}

function createReadSelectMock(steps: QueryStep[]) {
  const queue = [...steps];

  return vi.fn(() => ({
    from(table: unknown) {
      const step = queue.shift();

      expect(step?.table).toBe(table);

      return {
        where: vi.fn(() => createAwaitableRows(step?.rows ?? [])),
      };
    },
  }));
}

function createDeleteMock(steps: DeleteStep[], calls: Array<{ table: unknown }>) {
  const queue = [...steps];

  return vi.fn((table: unknown) => ({
    where: vi.fn(async () => {
      const step = queue.shift();

      expect(step?.table).toBe(table);
      calls.push({ table });
    }),
  }));
}

function createInsertMock(steps: InsertStep[], calls: Array<{ table: unknown; values: unknown }>) {
  const queue = [...steps];

  return vi.fn((table: unknown) => ({
    values: vi.fn((values: unknown) => {
      const step = queue.shift();

      expect(step?.table).toBe(table);
      calls.push({ table, values });

      if (step?.rows) {
        return {
          returning: vi.fn(async () => step.rows),
        };
      }

      return Promise.resolve();
    }),
  }));
}

describe('site architecture persistence', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('links an existing program without rewriting its stacks', async () => {
    const deleteCalls: Array<{ table: unknown }> = [];
    const insertCalls: Array<{ table: unknown; values: unknown }> = [];
    const app = {
      db: {
        read: {
          select: vi.fn(),
        },
        write: {
          delete: createDeleteMock([{ table: SiteArchitectures }], deleteCalls),
          insert: createInsertMock([{ table: SiteArchitectures }], insertCalls),
        },
      },
    } as any;

    await syncSiteArchitecture(app, 'site-1', {
      architecture: {
        program_id: 'program-1',
        program_name: 'Astro',
        stacks: [
          {
            category: 'FRAMEWORK',
            catalog_id: 'catalog-astro',
            name: 'Astro',
            name_normalized: 'astro',
          },
          {
            category: 'LANGUAGE',
            catalog_id: 'catalog-typescript',
            name: 'TypeScript',
            name_normalized: 'typescript',
          },
        ],
      },
    } as any);

    expect(app.db.read.select).not.toHaveBeenCalled();
    expect(deleteCalls).toEqual([{ table: SiteArchitectures }]);
    expect(insertCalls).toEqual([
      {
        table: SiteArchitectures,
        values: {
          site_id: 'site-1',
          program_id: 'program-1',
        },
      },
    ]);
  });

  it('creates or reuses a custom program and replaces its persisted stacks', async () => {
    const insertCalls: Array<{ table: unknown; values: unknown }> = [];
    const deleteCalls: Array<{ table: unknown }> = [];
    const app = {
      db: {
        read: {
          select: createReadSelectMock([
            {
              table: Programs,
              rows: [],
            },
            {
              table: TechnologyCatalogs,
              rows: [
                {
                  id: 'catalog-astro',
                  name: 'Astro',
                  technology_type: 'FRAMEWORK',
                },
                {
                  id: 'catalog-typescript',
                  name: 'TypeScript',
                  technology_type: 'LANGUAGE',
                },
              ],
            },
          ]),
        },
        write: {
          delete: createDeleteMock(
            [{ table: SiteArchitectures }, { table: ProgramTechnologyStacks }],
            deleteCalls,
          ),
          insert: createInsertMock(
            [
              {
                table: Programs,
                rows: [{ id: 'program-astro' }],
              },
              {
                table: SiteArchitectures,
              },
              {
                table: ProgramTechnologyStacks,
              },
            ],
            insertCalls,
          ),
        },
      },
    } as any;

    await syncSiteArchitecture(app, 'site-1', {
      architecture: {
        program_name: 'Astro',
        repo_url: 'https://github.com/withastro/astro',
        stacks: [
          {
            category: 'FRAMEWORK',
            catalog_id: 'catalog-astro',
            name: 'Astro',
            name_normalized: 'astro',
          },
          {
            category: 'LANGUAGE',
            catalog_id: 'catalog-typescript',
            name: 'TypeScript',
            name_normalized: 'typescript',
          },
        ],
      },
    } as any);

    expect(deleteCalls).toEqual([{ table: SiteArchitectures }, { table: ProgramTechnologyStacks }]);
    expect(insertCalls[0]).toEqual({
      table: Programs,
      values: {
        name: 'Astro',
        name_normalized: 'astro',
        is_open_source: undefined,
        website_url: 'https://github.com/withastro/astro',
        repo_url: 'https://github.com/withastro/astro',
        is_enabled: true,
      },
    });
    expect(insertCalls[1]).toEqual({
      table: SiteArchitectures,
      values: {
        site_id: 'site-1',
        program_id: 'program-astro',
      },
    });
    expect(insertCalls[2]).toEqual({
      table: ProgramTechnologyStacks,
      values: [
        {
          program_id: 'program-astro',
          category: 'FRAMEWORK',
          catalog_id: 'catalog-astro',
          name_custom: null,
          name_normalized: 'astro',
        },
        {
          program_id: 'program-astro',
          category: 'LANGUAGE',
          catalog_id: 'catalog-typescript',
          name_custom: null,
          name_normalized: 'typescript',
        },
      ],
    });
  });

  it('rejects stack catalog ids whose catalog type does not match the submitted category', async () => {
    const app = {
      db: {
        read: {
          select: createReadSelectMock([
            {
              table: TechnologyCatalogs,
              rows: [
                {
                  id: 'catalog-typescript',
                  technology_type: 'LANGUAGE',
                },
              ],
            },
          ]),
        },
      },
    } as any;

    await expect(
      ensureTechnologyIdsExist(app, {
        program_name: 'Astro',
        stacks: [
          {
            category: 'FRAMEWORK',
            catalog_id: 'catalog-typescript',
            name: 'TypeScript',
            name_normalized: 'typescript',
          },
        ],
      }),
    ).resolves.toBe(false);
  });

  it('materializes structured sub_tags into site tag relations', async () => {
    const insertCalls: Array<{ table: unknown; values: unknown }> = [];
    const deleteCalls: Array<{ table: unknown }> = [];
    const app = {
      db: {
        read: {
          select: createReadSelectMock([
            {
              table: TagDefinitions,
              rows: [],
            },
          ]),
        },
        write: {
          delete: createDeleteMock([{ table: SiteTags }], deleteCalls),
          insert: createInsertMock(
            [
              {
                table: TagDefinitions,
                rows: [{ id: 'sub-tag-custom', name: '前端' }],
              },
              {
                table: SiteTags,
              },
            ],
            insertCalls,
          ),
        },
      },
    } as any;

    await syncSiteTags(app, 'site-1', {
      main_tag: {
        tag_id: 'main-tag-1',
        name: null,
        name_normalized: null,
      },
      sub_tags: [
        {
          tag_id: 'sub-tag-existing',
          name: '开发',
          name_normalized: '开发',
        },
        {
          tag_id: null,
          name: '前端',
          name_normalized: '前端',
        },
      ],
    } as any);

    expect(deleteCalls).toEqual([{ table: SiteTags }]);
    expect(insertCalls[0]).toEqual({
      table: TagDefinitions,
      values: [
        {
          name: '前端',
          tag_type: 'SUB',
          is_enabled: true,
        },
      ],
    });
    expect(insertCalls[1]).toEqual({
      table: SiteTags,
      values: [
        {
          site_id: 'site-1',
          tag_id: 'main-tag-1',
        },
        {
          site_id: 'site-1',
          tag_id: 'sub-tag-custom',
        },
        {
          site_id: 'site-1',
          tag_id: 'sub-tag-existing',
        },
      ],
    });
  });
});
