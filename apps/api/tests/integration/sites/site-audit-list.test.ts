import { SiteAudits } from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockReadSelect } from '@tests/fixtures/db-mocks';

import { mockManagementUser } from './site-test.helpers';

describe('site audit read routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('lists site audits in the paginated management response envelope', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();
    mockManagementUser(app, 'site_audit.review');

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [{ total: 21 }],
      },
      {
        table: SiteAudits,
        rows: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            action: 'CREATE',
            status: 'PENDING',
            site_id: null,
            submitter_name: null,
            submitter_email: null,
            submit_reason: 'Request inclusion for my site.',
            created_time: new Date('2026-04-06T06:00:00.000Z'),
            reviewed_time: null,
            current_snapshot: null,
            proposed_snapshot: {
              name: 'Example Blog',
              url: 'https://example.com',
            },
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/management/site-audits?status=PENDING&page=2&pageSize=10',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            action: 'CREATE',
            status: 'PENDING',
            site_id: null,
            site_name: 'Example Blog',
            submitter_name: null,
            submitter_email: null,
            submit_reason: 'Request inclusion for my site.',
            created_time: '2026-04-06T06:00:00.000Z',
            reviewed_time: null,
          },
        ],
        pagination: {
          page: 2,
          pageSize: 10,
          totalItems: 21,
          totalPages: 3,
        },
      },
    });
  });

  it('returns structured audit detail with effective and override changes for approved updates', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();
    mockManagementUser(app, 'site_audit.review');

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            action: 'UPDATE',
            status: 'APPROVED',
            site_id: 'site-example-id',
            submitter_name: 'Alice',
            submitter_email: 'alice@example.com',
            submit_reason: 'Refresh metadata',
            notify_by_email: true,
            reviewer_comment: 'Adjusted status manually',
            diff: [
              {
                field: 'recommend',
                before: false,
                after: true,
              },
              {
                field: 'status',
                before: 'OK',
                after: 'ERROR',
              },
            ],
            current_snapshot: {
              name: 'Example Blog',
              url: 'https://example.com',
              sign: 'Old sign',
              feed: [
                {
                  name: '主订阅',
                  url: 'https://example.com/feed',
                  isDefault: true,
                  type: 'RSS',
                },
              ],
              main_tag: {
                tag_id: 'main-tag-id',
                name: '后端',
                name_normalized: '后端',
              },
              sub_tags: [
                {
                  tag_id: 'sub-tag-id',
                  name: '开发',
                  name_normalized: '开发',
                },
              ],
              architecture: {
                program_name: 'Ghost',
                program_is_open_source: true,
                stacks: [
                  {
                    category: 'FRAMEWORK',
                    catalog_id: 'framework-id',
                    name: 'Astro',
                    name_normalized: 'astro',
                  },
                ],
                website_url: 'https://ghost.org',
                repo_url: 'https://github.com/ghost/ghost',
              },
              from: ['WEB_SUBMIT'],
              classification_status: 'COMPLETE',
              sitemap: null,
              link_page: null,
              access_scope: 'BOTH',
              status: 'OK',
              is_show: true,
              recommend: false,
              reason: null,
              bid: 'example-blog',
              icon_base64: null,
            },
            proposed_snapshot: {
              name: 'Example Blog',
              url: 'https://example.com',
              sign: 'Old sign',
              feed: [
                {
                  name: '主订阅',
                  url: 'https://example.com/feed',
                  isDefault: true,
                  type: 'RSS',
                },
              ],
              main_tag: {
                tag_id: 'main-tag-id',
                name: '后端',
                name_normalized: '后端',
              },
              sub_tags: [
                {
                  tag_id: 'sub-tag-id',
                  name: '开发',
                  name_normalized: '开发',
                },
              ],
              architecture: {
                program_name: 'Ghost',
                program_is_open_source: true,
                stacks: [
                  {
                    category: 'FRAMEWORK',
                    catalog_id: 'framework-id',
                    name: 'Astro',
                    name_normalized: 'astro',
                  },
                ],
                website_url: 'https://ghost.org',
                repo_url: 'https://github.com/ghost/ghost',
              },
              from: ['WEB_SUBMIT'],
              classification_status: 'COMPLETE',
              sitemap: null,
              link_page: null,
              access_scope: 'BOTH',
              status: 'OK',
              is_show: true,
              recommend: true,
              reason: null,
              bid: 'example-blog',
              icon_base64: null,
            },
            review_override_snapshot: {
              name: 'Example Blog',
              url: 'https://example.com',
              sign: 'Old sign',
              feed: [
                {
                  name: '主订阅',
                  url: 'https://example.com/feed',
                  isDefault: true,
                  type: 'RSS',
                },
              ],
              main_tag: {
                tag_id: 'main-tag-id',
                name: '后端',
                name_normalized: '后端',
              },
              sub_tags: [
                {
                  tag_id: 'sub-tag-id',
                  name: '开发',
                  name_normalized: '开发',
                },
              ],
              architecture: {
                program_name: 'Ghost',
                program_is_open_source: true,
                stacks: [
                  {
                    category: 'FRAMEWORK',
                    catalog_id: 'framework-id',
                    name: 'Astro',
                    name_normalized: 'astro',
                  },
                ],
                website_url: 'https://ghost.org',
                repo_url: 'https://github.com/ghost/ghost',
              },
              from: ['WEB_SUBMIT'],
              classification_status: 'COMPLETE',
              sitemap: null,
              link_page: null,
              access_scope: 'BOTH',
              status: 'ERROR',
              is_show: true,
              recommend: true,
              reason: null,
              bid: 'example-blog',
              icon_base64: null,
            },
            review_override_diff: [
              {
                field: 'status',
                before: 'OK',
                after: 'ERROR',
              },
            ],
            created_time: new Date('2026-04-06T06:00:00.000Z'),
            reviewed_time: new Date('2026-04-06T06:10:00.000Z'),
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/management/site-audits/11111111-1111-4111-8111-111111111111',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        action: 'UPDATE',
        status: 'APPROVED',
        site_name: 'Example Blog',
        action_view: expect.objectContaining({
          kind: 'UPDATE',
          changes: [],
          effective_changes: [],
          review_override_changes: [],
          submitted_fields: expect.arrayContaining([
            {
              field: 'feed',
              label: '订阅地址',
              value_display: '默认订阅 · 主订阅 · https://example.com/feed · RSS',
            },
            {
              field: 'main_tag',
              label: '主分类',
              value_display: '后端',
            },
            {
              field: 'sub_tags',
              label: '子分类',
              value_display: '开发',
            },
            {
              field: 'architecture',
              label: '程序与技术栈',
              value_display:
                '程序：Ghost\n开源：是\n技术栈：Astro\n官网：https://ghost.org\n仓库：https://github.com/ghost/ghost',
            },
          ]),
        }),
        created_time: '2026-04-06T06:00:00.000Z',
        reviewed_time: '2026-04-06T06:10:00.000Z',
      }),
    });
  });
});
