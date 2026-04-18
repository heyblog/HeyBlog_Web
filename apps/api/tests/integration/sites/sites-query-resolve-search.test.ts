import {
  ProgramTechnologyStacks,
  SiteArchitectures,
  SiteAudits,
  Sites,
  SiteTags,
} from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockReadSelect } from '@tests/fixtures/db-mocks';

describe('site submission routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('queries a submission by audit id and email', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            action: 'CREATE',
            status: 'APPROVED',
            site_id: '22222222-2222-4222-8222-222222222222',
            current_snapshot: null,
            proposed_snapshot: {
              name: 'Example Blog',
            },
            reviewer_comment: 'Looks good.',
            created_time: new Date('2026-03-18T08:00:00.000Z'),
            reviewed_time: new Date('2026-03-19T09:30:00.000Z'),
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites/submissions/query',
      payload: {
        audit_id: '11111111-1111-4111-8111-111111111111',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        audit_id: '11111111-1111-4111-8111-111111111111',
        action: 'CREATE',
        status: 'APPROVED',
        site_id: '22222222-2222-4222-8222-222222222222',
        site_name: 'Example Blog',
        reviewer_comment: 'Looks good.',
        created_time: '2026-03-18T08:00:00.000Z',
        reviewed_time: '2026-03-19T09:30:00.000Z',
      },
    });
  });

  it('returns 404 when no submission matches audit id', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites/submissions/query',
      payload: {
        audit_id: '11111111-1111-4111-8111-111111111111',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'SUBMISSION_NOT_FOUND',
        message: 'No matching submission was found for the provided audit ID.',
      },
    });
  });

  it('resolves a site target by url with editable snapshot data', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    const siteId = '11111111-1111-4111-8111-111111111111';

    mockReadSelect(app, [
      {
        table: Sites,
        rows: [
          {
            site_id: siteId,
            bid: 'example-blog',
            name: 'Example Blog',
            url: 'https://example.com',
          },
        ],
      },
      {
        table: Sites,
        rows: [
          {
            id: siteId,
            bid: 'example-blog',
            name: 'Example Blog',
            url: 'https://example.com',
            sign: 'A blog about software',
            icon_base64: null,
            feed: [
              {
                name: '默认订阅',
                url: 'https://example.com/feed.xml',
                type: 'RSS',
                isDefault: true,
              },
            ],
            from: ['WEB_SUBMIT'],
            classification_status: 'COMPLETE',
            sitemap: 'https://example.com/sitemap.xml',
            link_page: 'https://example.com/friends',
            access_scope: 'ALL',
            status: 'OK',
            is_show: true,
            recommend: false,
            reason: null,
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
      {
        table: ProgramTechnologyStacks,
        rows: [],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites/resolve',
      payload: {
        url: 'https://example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        site_id: siteId,
        bid: 'example-blog',
        name: 'Example Blog',
        url: 'https://example.com',
        sign: 'A blog about software',
        feed: [
          {
            name: '默认订阅',
            url: 'https://example.com/feed.xml',
            type: 'RSS',
            isDefault: true,
          },
        ],
        sitemap: 'https://example.com/sitemap.xml',
        link_page: 'https://example.com/friends',
        main_tag_id: null,
        sub_tags: [],
        architecture: null,
      },
    });
  });

  it('returns 404 when the site lookup target does not exist', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: Sites,
        rows: [],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites/resolve',
      payload: {
        bid: 'missing-site',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'SITE_NOT_FOUND',
        message: 'The target site does not exist.',
      },
    });
  });

  it('searches visible sites for update and delete flows', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: Sites,
        rows: [
          {
            site_id: '11111111-1111-4111-8111-111111111111',
            bid: 'example-blog',
            name: 'Example Blog',
            url: 'https://example.com',
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites/search',
      payload: {
        query: 'example',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: [
        {
          site_id: '11111111-1111-4111-8111-111111111111',
          bid: 'example-blog',
          name: 'Example Blog',
          url: 'https://example.com',
        },
      ],
    });
  });
});
