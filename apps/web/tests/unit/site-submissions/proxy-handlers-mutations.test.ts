import { describe, expect, it, vi } from 'vitest';

import {
  handleCreateSubmissionRequest,
  handleDeleteSubmissionRequest,
  handleUpdateSubmissionRequest,
} from '@/application/site-submission/site-submission.server-handler';
import { getApiBaseUrl, getWebBaseUrl } from '@tests/setup/env';
import { siteSubmissionApiStubs } from '@tests/setup/site-submission/api-stubs';

describe('site submission proxy mutation handlers', () => {
  it('proxies create submissions to the API service', async () => {
    const fetchMock = vi.fn(async () => siteSubmissionApiStubs.created());
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateSubmissionRequest(
      new Request(`${getWebBaseUrl()}/api/site-submissions/create`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          submitter_name: 'Alice',
          submitter_email: 'alice@example.com',
          submit_reason: 'Request inclusion',
          notify_by_email: false,
          site: {
            name: 'Example Blog',
            url: 'https://example.com',
            sign: 'A blog about software',
            main_tag_id: 'main-tag-id',
          },
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${getApiBaseUrl()}/api/sites`,
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      ok: true,
      data: {
        audit_id: '11111111-1111-4111-8111-111111111111',
        action: 'CREATE',
        status: 'PENDING',
        site_id: null,
      },
    });
  });

  it('accepts nullable contact fields when proxying create submissions', async () => {
    const fetchMock = vi.fn(async () => siteSubmissionApiStubs.created());
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateSubmissionRequest(
      new Request(`${getWebBaseUrl()}/api/site-submissions/create`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          submitter_name: null,
          submitter_email: null,
          submit_reason: 'Request inclusion',
          notify_by_email: false,
          site: {
            name: 'Example Blog',
            url: 'https://example.com',
            sign: 'A blog about software',
            main_tag_id: 'main-tag-id',
          },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledWith(
      `${getApiBaseUrl()}/api/sites`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          submitter_name: null,
          submitter_email: null,
          submit_reason: 'Request inclusion',
          notify_by_email: false,
          site: {
            name: 'Example Blog',
            url: 'https://example.com',
            sign: 'A blog about software',
            main_tag_id: 'main-tag-id',
          },
        }),
      }),
    );
  });

  it('resolves update targets before forwarding the update submission', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(siteSubmissionApiStubs.resolvedSite())
      .mockResolvedValueOnce(siteSubmissionApiStubs.updated());
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleUpdateSubmissionRequest(
      new Request(`${getWebBaseUrl()}/api/site-submissions/update`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          submitter_name: 'Alice',
          submitter_email: 'alice@example.com',
          submit_reason: 'Refresh profile',
          notify_by_email: false,
          site_identifier: 'https://example.com',
          changes: {
            sign: 'New sign',
          },
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${getApiBaseUrl()}/api/sites/resolve`,
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${getApiBaseUrl()}/api/sites/11111111-1111-4111-8111-111111111111/updates`,
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(response.status).toBe(201);
  });

  it('resolves delete targets before forwarding the delete submission', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(siteSubmissionApiStubs.resolvedSite())
      .mockResolvedValueOnce(siteSubmissionApiStubs.deleted());
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleDeleteSubmissionRequest(
      new Request(`${getWebBaseUrl()}/api/site-submissions/delete`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          submitter_name: 'Alice',
          submitter_email: 'alice@example.com',
          submit_reason: 'Site is no longer maintained',
          notify_by_email: true,
          site_identifier: 'example-blog',
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${getApiBaseUrl()}/api/sites/resolve`,
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${getApiBaseUrl()}/api/sites/11111111-1111-4111-8111-111111111111/deletions`,
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(response.status).toBe(201);
  });
});
