import { Programs, Sites, TagDefinitions, TechnologyCatalogs } from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockReadSelect } from '@tests/fixtures/db-mocks';

describe('public site discovery routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;
  const mainTagId = '11111111-1111-4111-8111-111111111111';
  const subTagId = '22222222-2222-4222-8222-222222222222';
  const systemId = '33333333-3333-4333-8333-333333333333';
  const frameworkId = '44444444-4444-4444-8444-444444444444';
  const languageId = '55555555-5555-4555-8555-555555555555';

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('loads submission option lists', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: TagDefinitions,
        rows: [
          { id: mainTagId, name: '技术博客', tag_type: 'MAIN' },
          { id: subTagId, name: '前端', tag_type: 'SUB' },
        ],
      },
      {
        table: Programs,
        rows: [
          { id: systemId, name: 'Astro' },
          { id: frameworkId, name: 'Svelte Program' },
        ],
      },
      {
        table: TechnologyCatalogs,
        rows: [
          { id: frameworkId, name: 'Svelte', technology_type: 'FRAMEWORK' },
          { id: languageId, name: 'TypeScript', technology_type: 'LANGUAGE' },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/sites/submission-options',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        main_tags: [{ id: mainTagId, name: '技术博客' }],
        sub_tags: [{ id: subTagId, name: '前端' }],
        programs: [
          { id: systemId, name: 'Astro' },
          { id: frameworkId, name: 'Svelte Program' },
        ],
        tech_stacks: [
          { id: frameworkId, name: 'Svelte', category: 'FRAMEWORK' },
          { id: languageId, name: 'TypeScript', category: 'LANGUAGE' },
        ],
      },
    });
  });

  it('uses database-derived path hints for public auto-fill fallback', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: Sites,
        rows: [
          {
            url: 'https://seed.example.com',
            feed: [
              {
                name: '默认订阅',
                url: 'https://seed.example.com/feed.xml',
                type: 'RSS',
                isDefault: true,
              },
            ],
            sitemap: 'https://seed.example.com/sitemap-main.xml',
            link_page: 'https://seed.example.com/links',
          },
        ],
      },
    ]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url === 'https://example.com') {
          throw new Error('network unavailable');
        }

        if (url === 'https://example.com/feed.xml') {
          return new Response('<rss version="2.0"><channel></channel></rss>', {
            status: 200,
            headers: {
              'content-type': 'application/rss+xml',
            },
          });
        }

        if (url === 'https://example.com/sitemap-main.xml') {
          return new Response('<urlset></urlset>', {
            status: 200,
            headers: {
              'content-type': 'application/xml',
            },
          });
        }

        if (url === 'https://example.com/links') {
          return new Response('<html><head><title>友情链接</title></head><body></body></html>', {
            status: 200,
            headers: {
              'content-type': 'text/html; charset=utf-8',
            },
          });
        }

        return new Response('not found', { status: 404 });
      }),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites/auto-fill',
      payload: {
        url: 'https://example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        name: '',
        sign: '',
        feed_candidates: expect.arrayContaining([
          {
            name: '默认订阅',
            url: 'https://example.com/feed.xml',
          },
        ]),
        sitemap: 'https://example.com/sitemap-main.xml',
        link_page: 'https://example.com/links',
        architecture: null,
        warnings: [
          '未能抓取站点首页，已继续探测常用订阅、站点地图和友链页地址；未通过验证的候选不会回填。',
        ],
      },
    });
  });
});
