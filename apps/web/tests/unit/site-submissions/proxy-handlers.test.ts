import { describe, expect, it, vi } from 'vitest';

import {
  handleCreateSubmissionRequest,
  handleDeleteSubmissionRequest,
  handleResolveSiteRequest,
  handleSiteAutoFillRequest,
  handleSiteOptionsRequest,
  handleSiteSearchRequest,
  handleSubmissionQueryRequest,
  handleUpdateSubmissionRequest,
} from '@/application/site-submission/site-submission.server-handler';
import { siteSubmissionApiStubs } from '@tests/setup/site-submission/api-stubs';

describe('site submission proxy handlers', () => {
  it('proxies create submissions to the API service', async () => {
    const fetchMock = vi.fn(async () => siteSubmissionApiStubs.created());

    vi.stubGlobal('fetch', fetchMock);

    const response = await handleCreateSubmissionRequest(
      new Request('http://127.0.0.1:9902/api/site-submissions/create', {
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
      'http://127.0.0.1:9901/api/sites',
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
      new Request('http://127.0.0.1:9902/api/site-submissions/create', {
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
      'http://127.0.0.1:9901/api/sites',
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
      new Request('http://127.0.0.1:9902/api/site-submissions/update', {
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
      'http://127.0.0.1:9901/api/sites/resolve',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:9901/api/sites/11111111-1111-4111-8111-111111111111/updates',
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
      new Request('http://127.0.0.1:9902/api/site-submissions/delete', {
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
      'http://127.0.0.1:9901/api/sites/resolve',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:9901/api/sites/11111111-1111-4111-8111-111111111111/deletions',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(response.status).toBe(201);
  });

  it('proxies options loading to the API service', async () => {
    const fetchMock = vi.fn(async () => siteSubmissionApiStubs.emptyOptions());

    vi.stubGlobal('fetch', fetchMock);

    const response = await handleSiteOptionsRequest(
      new Request('http://127.0.0.1:9902/api/site-submissions/options'),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:9901/api/sites/submission-options',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(response.status).toBe(200);
  });

  it('proxies submission status queries to the API service', async () => {
    const fetchMock = vi.fn(async () => siteSubmissionApiStubs.queryResult());

    vi.stubGlobal('fetch', fetchMock);

    const response = await handleSubmissionQueryRequest(
      new Request('http://127.0.0.1:9902/api/site-submissions/query', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          audit_id: '22222222-2222-4222-8222-222222222222',
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:9901/api/sites/submissions/query',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(response.status).toBe(200);
  });

  it('proxies public site searches to the API service', async () => {
    const fetchMock = vi.fn(async () => siteSubmissionApiStubs.searchResults());

    vi.stubGlobal('fetch', fetchMock);

    const response = await handleSiteSearchRequest(
      new Request('http://127.0.0.1:9902/api/site-submissions/search', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          query: 'example',
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:9901/api/sites/search',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(response.status).toBe(200);
  });

  it('proxies public auto-fill requests to the API service', async () => {
    const fetchMock = vi.fn(async () => siteSubmissionApiStubs.autoFilled());

    vi.stubGlobal('fetch', fetchMock);

    const response = await handleSiteAutoFillRequest(
      new Request('http://127.0.0.1:9902/api/site-submissions/auto-fill', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://example.com',
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:9901/api/sites/auto-fill',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(response.status).toBe(200);
  });

  it('proxies site resolution to the API service', async () => {
    const fetchMock = vi.fn(async () => siteSubmissionApiStubs.resolvedSite());

    vi.stubGlobal('fetch', fetchMock);

    const response = await handleResolveSiteRequest(
      new Request('http://127.0.0.1:9902/api/site-submissions/resolve', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          bid: 'example-blog',
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:9901/api/sites/resolve',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(response.status).toBe(200);
  });

  it('returns 400 for malformed query request bodies', async () => {
    const response = await handleSubmissionQueryRequest(
      new Request('http://127.0.0.1:9902/api/site-submissions/query', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          audit_id: 123,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: 'INVALID_BODY',
        message: 'Request body is invalid for a site submission query.',
      },
    });
  });
});
