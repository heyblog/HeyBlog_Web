import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@tests/create-test-app';
import { mockWriteInsertSuccess } from '@tests/fixtures/db-mocks';

import {
  mockSiteUpdateFlowReads,
  updateFlowFrameworkId,
  updateFlowSiteId,
} from './sites-update-flows.helpers';

describe('site update submission success flows', () => {
  let app: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('submits a site update as a pending audit with merged snapshots', async () => {
    app = createTestApp({ disableExternalServices: true });
    await app.ready();

    mockSiteUpdateFlowReads(app, {
      includeCatalogs: true,
    });

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-update-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${updateFlowSiteId}/updates`,
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
        site_id: updateFlowSiteId,
      },
    });

    expect(writeMock.getInsertedValues()).toMatchObject({
      site_id: updateFlowSiteId,
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
    app = createTestApp({ disableExternalServices: true });
    await app.ready();

    mockSiteUpdateFlowReads(app);

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-update-null-contact-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${updateFlowSiteId}/updates`,
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
    app = createTestApp({ disableExternalServices: true });
    await app.ready();

    mockSiteUpdateFlowReads(app);

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-update-empty-reason-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${updateFlowSiteId}/updates`,
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
    app = createTestApp({ disableExternalServices: true });
    await app.ready();

    mockSiteUpdateFlowReads(app, {
      siteOverrides: {
        sitemap: null,
        link_page: null,
      },
      includeCatalogs: true,
    });

    const writeMock = mockWriteInsertSuccess(app, [
      {
        id: 'audit-update-arch-id',
        status: 'PENDING',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: `/api/sites/${updateFlowSiteId}/updates`,
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
                catalog_id: updateFlowFrameworkId,
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
              catalog_id: updateFlowFrameworkId,
              name: 'Astro',
              name_normalized: 'astro',
            },
          ],
        },
      },
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
});
