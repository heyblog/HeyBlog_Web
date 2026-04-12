import {
  Programs,
  SiteArchitectures,
  SiteAudits,
  Sites,
  SiteTags,
  TagDefinitions,
  TechnologyCatalogs,
} from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockReadSelect, mockWriteUpdateSequence } from '@tests/fixtures/db-mocks';

describe('site submission routes', () => {
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

  it('soft-deletes the site when a delete audit is approved', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    app.auth.getCurrentUser = vi.fn(async () => ({
      id: '33333333-3333-4333-8333-333333333333',
      role: 'ADMIN',
      permissions: ['site_audit.review'],
    })) as unknown as typeof app.auth.getCurrentUser;

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            action: 'DELETE',
            status: 'PENDING',
            site_id: '22222222-2222-4222-8222-222222222222',
            submit_reason: 'Site is retired.',
            submitter_email: 'alice@example.com',
            notify_by_email: false,
            current_snapshot: {
              name: 'Example Blog',
              url: 'https://example.com',
              is_show: true,
              reason: null,
            },
            proposed_snapshot: {
              name: 'Example Blog',
              url: 'https://example.com',
              is_show: false,
              reason: 'Site is retired.',
            },
          },
        ],
      },
      {
        table: Sites,
        rows: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            bid: null,
            name: 'Example Blog',
            url: 'https://example.com',
            sign: '',
            icon_base64: null,
            feed: [],
            from: ['WEB_SUBMIT'],
            classification_status: 'NEEDS_REVIEW',
            sitemap: null,
            link_page: null,
            access_scope: 'BOTH',
            status: 'OK',
            is_show: false,
            recommend: false,
            reason: 'Site is retired. ｜ 审核备注：Confirmed offline',
            update_time: new Date('2026-04-06T06:00:00.000Z'),
          },
        ],
      },
      {
        table: SiteTags,
        rows: [],
      },
      {
        table: SiteArchitectures,
        rows: [],
      },
    ]);

    const updateMock = mockWriteUpdateSequence(app, [
      {
        table: Sites,
      },
      {
        table: SiteAudits,
        rows: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            action: 'DELETE',
            status: 'APPROVED',
            site_id: '22222222-2222-4222-8222-222222222222',
            submitter_email: 'alice@example.com',
            notify_by_email: false,
            reviewer_comment: 'Confirmed offline',
            current_snapshot: {
              name: 'Example Blog',
            },
            proposed_snapshot: {
              name: 'Example Blog',
            },
          },
        ],
      },
      {
        table: SiteAudits,
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/management/site-audits/11111111-1111-4111-8111-111111111111/review',
      payload: {
        decision: 'APPROVED',
        reviewer_comment: 'Confirmed offline',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        audit_id: '11111111-1111-4111-8111-111111111111',
        action: 'DELETE',
        status: 'APPROVED',
        site_id: '22222222-2222-4222-8222-222222222222',
      },
    });

    expect(updateMock.getCapturedValues()[0]).toMatchObject({
      is_show: false,
      reason: 'Site is retired. ｜ 审核备注：Confirmed offline',
    });
    expect(updateMock.getCapturedValues()[1]).toMatchObject({
      status: 'APPROVED',
      reviewer_comment: 'Confirmed offline',
      reviewed_by: '33333333-3333-4333-8333-333333333333',
    });
  });

  it('rejects malformed submission query payloads', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites/submissions/query',
      payload: {
        audit_id: 'bad-id',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'INVALID_BODY',
        message: 'Request body is invalid for a site submission query.',
      },
    });
  });
});
