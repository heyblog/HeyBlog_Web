import {
  ProgramTechnologyStacks,
  SiteArchitectures,
  SiteAudits,
  Sites,
  SiteTags,
  TechnologyCatalogs,
} from '@zhblogs/db';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockReadSelect, mockWriteInsertSuccess } from '@tests/fixtures/db-mocks';

describe('site submission routes', () => {
  let app: ReturnType<typeof createTestApp> | undefined;
  const frameworkId = '44444444-4444-4444-8444-444444444444';

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('submits a site update as a pending audit with merged snapshots', async () => {
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
            id: siteId,
            bid: 'example-blog',
            name: 'Example Blog',
            url: 'https://example.com',
            sign: 'Old sign',
            icon_base64: null,
            feed: [],
            from: ['WEB_SUBMIT'],
            classification_status: 'COMPLETE',
            sitemap: 'https://example.com/sitemap.xml',
            link_page: 'https://example.com/friends',
            access_scope: 'BOTH',
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
      {
        table: SiteAudits,
        rows: [],
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
        id: 'audit-update-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${siteId}/updates`,
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Please refresh the site profile.',
        notify_by_email: false,
        changes: {
          sign: 'New sign',
          link_page: null,
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        audit_id: 'audit-update-id',
        action: 'UPDATE',
        status: 'PENDING',
        site_id: siteId,
      },
    });

    expect(writeMock.getInsertedValues()).toMatchObject({
      site_id: siteId,
      action: 'UPDATE',
      notify_by_email: false,
      current_snapshot: {
        sign: 'Old sign',
        link_page: 'https://example.com/friends',
      },
      proposed_snapshot: {
        sign: 'New sign',
        link_page: null,
      },
    });

    expect(writeMock.getInsertedValues()).toMatchObject({
      diff: expect.arrayContaining([
        expect.objectContaining({
          field: 'sign',
          before: 'Old sign',
          after: 'New sign',
        }),
        expect.objectContaining({
          field: 'link_page',
          before: 'https://example.com/friends',
          after: null,
        }),
      ]),
    });
  });

  it('stores nullable submitter info for update submissions without contact fields', async () => {
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
            id: siteId,
            bid: 'example-blog',
            name: 'Example Blog',
            url: 'https://example.com',
            sign: 'Old sign',
            icon_base64: null,
            feed: [],
            from: ['WEB_SUBMIT'],
            classification_status: 'COMPLETE',
            sitemap: 'https://example.com/sitemap.xml',
            link_page: 'https://example.com/friends',
            access_scope: 'BOTH',
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
      {
        table: SiteAudits,
        rows: [],
      },
      {
        table: Sites,
        rows: [],
      },
    ]);

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-update-null-contact-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${siteId}/updates`,
      payload: {
        submitter_name: null,
        submitter_email: null,
        submit_reason: 'Please refresh the site profile.',
        notify_by_email: false,
        changes: {
          sign: 'New sign',
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(writeMock.getInsertedValues()).toMatchObject({
      submitter_name: null,
      submitter_email: null,
    });
  });

  it('accepts a blank update reason and stores it as an empty string', async () => {
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
            id: siteId,
            bid: 'example-blog',
            name: 'Example Blog',
            url: 'https://example.com',
            sign: 'Old sign',
            icon_base64: null,
            feed: [],
            from: ['WEB_SUBMIT'],
            classification_status: 'COMPLETE',
            sitemap: 'https://example.com/sitemap.xml',
            link_page: 'https://example.com/friends',
            access_scope: 'BOTH',
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
      {
        table: SiteAudits,
        rows: [],
      },
      {
        table: Sites,
        rows: [],
      },
    ]);

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-update-empty-reason-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${siteId}/updates`,
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: '',
        notify_by_email: false,
        changes: {
          sign: 'New sign',
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(writeMock.getInsertedValues()).toMatchObject({
      submit_reason: '',
    });
  });

  it('keeps architecture stacks in update snapshot', async () => {
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
            id: siteId,
            bid: 'example-blog',
            name: 'Example Blog',
            url: 'https://example.com',
            sign: 'Old sign',
            icon_base64: null,
            feed: [],
            from: ['WEB_SUBMIT'],
            classification_status: 'COMPLETE',
            sitemap: null,
            link_page: null,
            access_scope: 'BOTH',
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
      {
        table: SiteAudits,
        rows: [],
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
        id: 'audit-update-arch-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${siteId}/updates`,
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Please update architecture.',
        notify_by_email: false,
        changes: {
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
    expect(writeMock.getInsertedValues()).toMatchObject({
      diff: expect.arrayContaining([
        expect.objectContaining({
          field: 'architecture',
          before: null,
          after: expect.objectContaining({
            program_name: 'Ghost',
            repo_url: 'https://github.com/ghost/ghost',
          }),
        }),
      ]),
    });
  });

  it('returns the active pending submission when the site already has an unfinished update flow', async () => {
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
            id: siteId,
            bid: 'example-blog',
            name: 'Example Blog',
            url: 'https://example.com',
            sign: 'Old sign',
            icon_base64: null,
            feed: [],
            from: ['WEB_SUBMIT'],
            classification_status: 'COMPLETE',
            sitemap: null,
            link_page: null,
            access_scope: 'BOTH',
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
      {
        table: SiteAudits,
        rows: [
          {
            id: 'audit-pending-existing',
          },
        ],
      },
      {
        table: SiteAudits,
        rows: [
          {
            id: 'audit-pending-existing',
            action: 'UPDATE',
            status: 'PENDING',
            site_id: siteId,
            created_time: new Date('2026-04-12T08:30:00.000Z'),
          },
        ],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${siteId}/updates`,
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Please refresh the site profile.',
        notify_by_email: false,
        changes: {
          sign: 'New sign',
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
          audit_id: 'audit-pending-existing',
          action: 'UPDATE',
          status: 'PENDING',
          created_time: '2026-04-12T08:30:00.000Z',
          site_id: siteId,
        },
      },
    });
  });

  it('returns 404 when the update target site does not exist', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    const siteId = '11111111-1111-4111-8111-111111111111';

    mockReadSelect(app, [
      {
        table: Sites,
        rows: [],
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${siteId}/updates`,
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Please refresh the site profile.',
        notify_by_email: false,
        changes: {
          sign: 'New sign',
        },
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

  it('returns 503 when update audit creation hits a dependency error', async () => {
    app = createTestApp({
      disableExternalServices: true,
    });

    await app.ready();

    app.db.read.select = vi.fn(() => {
      throw new Error('db unavailable');
    }) as unknown as typeof app.db.read.select;

    const siteId = '11111111-1111-4111-8111-111111111111';

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${siteId}/updates`,
      payload: {
        submitter_name: 'Alice',
        submitter_email: 'alice@example.com',
        submit_reason: 'Please refresh the site profile.',
        notify_by_email: false,
        changes: {
          sign: 'New sign',
        },
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: 'DEPENDENCY_ERROR',
        message: 'Unable to persist the site update submission right now.',
      },
    });
  });
});
