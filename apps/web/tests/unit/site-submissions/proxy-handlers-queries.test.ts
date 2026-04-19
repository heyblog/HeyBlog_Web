import { describe, expect, it, vi } from 'vitest';

import {
  handleResolveSiteRequest,
  handleSiteAutoFillRequest,
  handleSiteOptionsRequest,
  handleSiteSearchRequest,
  handleSubmissionQueryRequest,
} from '@/application/site-submission/site-submission.server-handler';
import { getApiBaseUrl, getWebBaseUrl } from '@tests/setup/env';
import { siteSubmissionApiStubs } from '@tests/setup/site-submission/api-stubs';

describe('site submission proxy query handlers', () => {
  it('proxies options loading to the API service', async () => {
    const fetchMock = vi.fn(async () => siteSubmissionApiStubs.emptyOptions());
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleSiteOptionsRequest(
      new Request(`${getWebBaseUrl()}/api/site-submissions/options`),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `${getApiBaseUrl()}/api/sites/submission-options`,
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
      new Request(`${getWebBaseUrl()}/api/site-submissions/query`, {
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
      `${getApiBaseUrl()}/api/sites/submissions/query`,
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
      new Request(`${getWebBaseUrl()}/api/site-submissions/search`, {
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
      `${getApiBaseUrl()}/api/sites/search`,
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
      new Request(`${getWebBaseUrl()}/api/site-submissions/auto-fill`, {
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
      `${getApiBaseUrl()}/api/sites/auto-fill`,
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
      new Request(`${getWebBaseUrl()}/api/site-submissions/resolve`, {
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
      `${getApiBaseUrl()}/api/sites/resolve`,
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(response.status).toBe(200);
  });

  it('returns 400 for malformed query request bodies', async () => {
    const response = await handleSubmissionQueryRequest(
      new Request('http://127.0.0.1:9101/api/site-submissions/query', {
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
