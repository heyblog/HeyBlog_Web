import { SiteAudits, Sites, TagDefinitions, TechnologyCatalogs } from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import {
  mockReadSelect,
  mockWriteInsertFailure,
  mockWriteInsertSuccess,
} from '@tests/fixtures/db-mocks';

describe('site submission routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;
  const mainTagId = '11111111-1111-4111-8111-111111111111';
  const subTagId = '22222222-2222-4222-8222-222222222222';
  const frameworkId = '44444444-4444-4444-8444-444444444444';
  const expectedMainTagSnapshot = {
    tag_id: mainTagId,
    name: '后端',
    name_normalized: '后端',
  };

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('submits a new site as a pending create audit', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [],
      },
      {
        table: TagDefinitions,
        rows: [
          { id: mainTagId, name: '后端', tag_type: 'MAIN' },
          { id: subTagId, name: '开发', tag_type: 'SUB' },
        ],
      },
      {
        table: TagDefinitions,
        rows: [
          { id: mainTagId, name: '后端', tag_type: 'MAIN' },
          { id: subTagId, name: '开发', tag_type: 'SUB' },
        ],
      },
      {
        table: TechnologyCatalogs,
        rows: [
          {
            id: frameworkId,
            name: 'Astro',
            name_normalized: 'astro',
            technology_type: 'FRAMEWORK',
          },
        ],
      },
      {
        table: Sites,
        rows: [],
      },
    ]);

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-create-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Request inclusion for my site.',
        notify_by_email: true,
        site: {
          name: 'Example Blog',
          url: 'https://example.com',
          sign: 'A blog about software',
          main_tag_id: mainTagId,
          sub_tags: [
            {
              tag_id: subTagId,
              name: '开发',
              name_normalized: '开发',
            },
            {
              tag_id: null,
              name: '前端',
              name_normalized: '前端',
            },
          ],
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        audit_id: 'audit-create-id',
        action: 'CREATE',
        status: 'PENDING',
        site_id: null,
      },
    });

    expect(writeMock.getInsertedValues()).toMatchObject({
      action: 'CREATE',
      submitter_name: 'Alice',
      submitter_email: 'alice@example.com',
      submit_reason: 'Request inclusion for my site.',
      notify_by_email: true,
      proposed_snapshot: {
        name: 'Example Blog',
        url: 'https://example.com',
        sign: 'A blog about software',
        from: ['WEB_SUBMIT'],
        classification_status: 'COMPLETE',
        main_tag: expectedMainTagSnapshot,
        sub_tags: [
          {
            tag_id: subTagId,
            name: '开发',
            name_normalized: '开发',
          },
          {
            tag_id: null,
            name: '前端',
            name_normalized: '前端',
          },
        ],
      },
    });

    expect(writeMock.getInsertedValues()).toMatchObject({
      diff: expect.arrayContaining([
        expect.objectContaining({ field: 'name', after: 'Example Blog' }),
        expect.objectContaining({ field: 'url', after: 'https://example.com' }),
        expect.objectContaining({ field: 'main_tag', after: expectedMainTagSnapshot }),
      ]),
    });
  });

  it('stores nullable submitter info when the create requester leaves contact fields empty', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [],
      },
      {
        table: TagDefinitions,
        rows: [{ id: mainTagId, name: '后端', tag_type: 'MAIN' }],
      },
      {
        table: TagDefinitions,
        rows: [{ id: mainTagId, name: '后端', tag_type: 'MAIN' }],
      },
      {
        table: TechnologyCatalogs,
        rows: [],
      },
      {
        table: Sites,
        rows: [],
      },
    ]);

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-create-null-contact-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: {
        submitter_name: null,
        submitter_email: null,
        submit_reason: 'Request inclusion for my site.',
        notify_by_email: false,
        site: {
          name: 'Example Blog',
          url: 'https://example.com',
          sign: 'A blog about software',
          main_tag_id: mainTagId,
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(writeMock.getInsertedValues()).toMatchObject({
      submitter_name: null,
      submitter_email: null,
    });
  });

  it('accepts a blank create reason and stores it as an empty string', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [],
      },
      {
        table: TagDefinitions,
        rows: [{ id: mainTagId, name: '后端', tag_type: 'MAIN' }],
      },
      {
        table: TagDefinitions,
        rows: [{ id: mainTagId, name: '后端', tag_type: 'MAIN' }],
      },
      {
        table: TechnologyCatalogs,
        rows: [],
      },
      {
        table: Sites,
        rows: [],
      },
    ]);

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-create-empty-reason-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: '',
        notify_by_email: false,
        site: {
          name: 'Example Blog',
          url: 'https://example.com',
          sign: 'A blog about software',
          main_tag_id: mainTagId,
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(writeMock.getInsertedValues()).toMatchObject({
      submit_reason: '',
    });
  });

  it('keeps architecture repo and stacks in create snapshot', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [],
      },
      {
        table: TagDefinitions,
        rows: [{ id: mainTagId, name: '后端', tag_type: 'MAIN' }],
      },
      {
        table: TagDefinitions,
        rows: [{ id: mainTagId, name: '后端', tag_type: 'MAIN' }],
      },
      {
        table: TechnologyCatalogs,
        rows: [
          {
            id: frameworkId,
            name: 'Astro',
            name_normalized: 'astro',
            technology_type: 'FRAMEWORK',
          },
        ],
      },
      {
        table: TechnologyCatalogs,
        rows: [
          {
            id: frameworkId,
            name: 'Astro',
            name_normalized: 'astro',
            technology_type: 'FRAMEWORK',
          },
        ],
      },
      {
        table: Sites,
        rows: [],
      },
    ]);

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-create-arch-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Request inclusion for my site.',
        notify_by_email: true,
        site: {
          name: 'Example Blog',
          url: 'https://example.com',
          sign: 'A blog about software',
          main_tag_id: mainTagId,
          architecture: {
            program_name: 'Ghost',
            website_url: null,
            repo_url: 'https://github.com/ghost/ghost',
            stacks: [
              {
                category: 'FRAMEWORK',
                catalog_id: frameworkId,
                name: 'Astro',
                name_normalized: 'astro',
              },
            ],
          },
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(writeMock.getInsertedValues()).toMatchObject({
      proposed_snapshot: {
        architecture: {
          program_name: 'Ghost',
          website_url: null,
          repo_url: 'https://github.com/ghost/ghost',
          stacks: [
            {
              category: 'FRAMEWORK',
              catalog_id: frameworkId,
              name: 'Astro',
              name_normalized: 'astro',
            },
          ],
        },
      },
    });
  });

  it('returns the active pending create submission when the same site is already awaiting review', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [
          {
            id: 'audit-create-pending-id',
            action: 'CREATE',
            status: 'PENDING',
            site_id: null,
            created_time: new Date('2026-04-12T08:00:00.000Z'),
            proposed_snapshot: {
              url: 'https://example.com',
              bid: 'example-blog',
            },
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Request inclusion for my site.',
        notify_by_email: false,
        site: {
          name: 'Example Blog',
          url: 'https://example.com',
          sign: 'A blog about software',
          main_tag_id: mainTagId,
        },
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'PENDING_AUDIT_EXISTS',
        message: 'There is already a pending submission for the target site.',
        active_submission: {
          audit_id: 'audit-create-pending-id',
          action: 'CREATE',
          status: 'PENDING',
          created_time: '2026-04-12T08:00:00.000Z',
          site_id: null,
        },
      },
    });
  });

  it('rejects malformed create submissions before touching the database', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'not-an-email',
        submit_reason: 'Request inclusion for my site.',
        notify_by_email: false,
        site: {
          name: 'Example Blog',
          url: 'https://example.com',
          sign: 'A blog about software',
          main_tag_id: mainTagId,
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'INVALID_BODY',
        message: 'Request body contains empty or malformed fields.',
        fields: ['submitter_email'],
      },
    });
  });

  it('rejects create submissions when feed urls are equivalent after normalization', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Request inclusion for my site.',
        notify_by_email: false,
        site: {
          name: 'Example Blog',
          url: 'https://example.com',
          sign: 'A blog about software',
          main_tag_id: mainTagId,
          feed: [
            {
              name: '主订阅',
              url: 'https://Example.com/feed.xml',
              isDefault: true,
            },
            {
              name: '备用订阅',
              url: 'https://example.com/feed.xml/',
              isDefault: false,
            },
          ],
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'INVALID_BODY',
        message: 'Request body contains empty or malformed fields.',
        fields: ['site.feed'],
      },
    });
  });

  it('returns a strong-duplicate contact response when a visible site shares the hostname', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [],
      },
      {
        table: TagDefinitions,
        rows: [{ id: mainTagId, name: '后端', tag_type: 'MAIN' }],
      },
      {
        table: Sites,
        rows: [
          {
            id: 'site-visible-id',
            bid: 'existing-example',
            name: 'Existing Example',
            url: 'https://example.com/archive',
            is_show: true,
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Request inclusion for my site.',
        notify_by_email: false,
        site: {
          name: 'Example Blog',
          url: 'https://example.com',
          sign: 'A blog about software',
          main_tag_id: mainTagId,
        },
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'SITE_DUPLICATE_STRONG_CONTACT_REQUIRED',
        message: '检测到已存在的公开站点，请不要重复新增；如需确认，请通过邮箱反馈。',
        duplicate_review: {
          strong: [
            {
              site_id: 'site-visible-id',
              bid: 'existing-example',
              name: 'Existing Example',
              url: 'https://example.com/archive',
              visibility: 'VISIBLE',
              reason: '站点域名一致',
            },
          ],
          weak: [],
        },
      },
    });
  });

  it('returns a restore-required response when a hidden site shares the hostname', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [],
      },
      {
        table: TagDefinitions,
        rows: [{ id: mainTagId, name: '后端', tag_type: 'MAIN' }],
      },
      {
        table: Sites,
        rows: [
          {
            id: 'site-hidden-id',
            bid: 'archived-example',
            name: 'Archived Example',
            url: 'https://example.com/old',
            is_show: false,
          },
        ],
      },
      {
        table: TagDefinitions,
        rows: [{ id: mainTagId, name: '后端', tag_type: 'MAIN' }],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Request inclusion for my site.',
        notify_by_email: false,
        site: {
          name: 'Example Blog',
          url: 'https://example.com',
          sign: 'A blog about software',
          main_tag_id: mainTagId,
        },
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'SITE_RESTORE_REQUIRED',
        message: '检测到已下线的同站点记录，请改走恢复流程。',
        duplicate_review: {
          strong: [
            {
              site_id: 'site-hidden-id',
              bid: 'archived-example',
              name: 'Archived Example',
              url: 'https://example.com/old',
              visibility: 'HIDDEN',
              reason: '站点域名一致',
            },
          ],
          weak: [],
        },
      },
    });
  });

  it('allows create submission after weak duplicates are explicitly confirmed', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [],
      },
      {
        table: TagDefinitions,
        rows: [{ id: mainTagId, name: '后端', tag_type: 'MAIN' }],
      },
      {
        table: SiteAudits,
        rows: [],
      },
      {
        table: Sites,
        rows: [
          {
            id: '77777777-7777-4777-8777-777777777777',
            bid: 'example-net',
            name: 'Example Blog',
            url: 'https://example.net',
            is_show: true,
          },
        ],
      },
      {
        table: TagDefinitions,
        rows: [{ id: mainTagId, name: '后端', tag_type: 'MAIN' }],
      },
      {
        table: Sites,
        rows: [
          {
            id: '77777777-7777-4777-8777-777777777777',
            bid: 'example-net',
            name: 'Example Blog',
            url: 'https://example.net',
            is_show: true,
          },
        ],
      },
      {
        table: SiteAudits,
        rows: [],
      },
      {
        table: TagDefinitions,
        rows: [{ id: mainTagId, name: '后端', tag_type: 'MAIN' }],
      },
    ]);

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-create-confirmed-id',
        status: 'PENDING',
      },
    ]);

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Request inclusion for my site.',
        notify_by_email: false,
        site: {
          name: 'Example Blog',
          url: 'https://example.com',
          sign: 'A blog about software',
          main_tag_id: mainTagId,
        },
      },
    });

    expect(firstResponse.statusCode).toBe(409);
    expect(firstResponse.json()).toEqual({
      ok: false,
      error: {
        code: 'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED',
        message: '检测到疑似重复站点，请确认后再继续提交。',
        duplicate_review: {
          strong: [],
          weak: [
            {
              site_id: '77777777-7777-4777-8777-777777777777',
              bid: 'example-net',
              name: 'Example Blog',
              url: 'https://example.net',
              visibility: 'VISIBLE',
              reason: '站点名称一致',
            },
          ],
        },
      },
    });

    const secondResponse = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Request inclusion for my site.',
        notify_by_email: false,
        duplicate_review: {
          confirmed_site_ids: ['77777777-7777-4777-8777-777777777777'],
        },
        site: {
          name: 'Example Blog',
          url: 'https://example.com',
          sign: 'A blog about software',
          main_tag_id: mainTagId,
        },
      },
    });

    expect(secondResponse.statusCode).toBe(201);
    expect(writeMock.getInsertedValues()).toMatchObject({
      action: 'CREATE',
      submit_reason: 'Request inclusion for my site.',
    });
  });

  it('returns 503 when create audit persistence fails', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    mockReadSelect(app, [
      {
        table: SiteAudits,
        rows: [],
      },
      {
        table: TagDefinitions,
        rows: [{ id: mainTagId }],
      },
      {
        table: Sites,
        rows: [],
      },
    ]);

    mockWriteInsertFailure(app, new Error('write failed'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Request inclusion for my site.',
        notify_by_email: false,
        site: {
          name: 'Example Blog',
          url: 'https://example.com',
          sign: 'A blog about software',
          main_tag_id: mainTagId,
        },
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'DEPENDENCY_ERROR',
        message: 'Unable to persist the site creation submission right now.',
      },
    });
  });
});
