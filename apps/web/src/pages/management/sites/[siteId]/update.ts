import type { APIRoute } from 'astro';

import {
  createSiteManagementActionJsonResponse,
  getManagedSiteLoginRedirect,
  isValidManagedSiteId,
  proxySiteManagementRequest,
  readSiteManagementApiErrorMessage,
  readSiteManagementEnvelopeData,
} from '@/application/management/site-management.server';

export const prerender = false;

const INVALID_REQUEST_MESSAGE = '站点编辑请求无效，请刷新后重试。';
const UPDATE_FAILURE_MESSAGE = '站点更新失败，请稍后重试。';

export const POST: APIRoute = async ({ request, params }) => {
  const siteId = params.siteId;

  if (!isValidManagedSiteId(siteId)) {
    return createSiteManagementActionJsonResponse(
      {
        ok: false,
        code: 'invalid_site_update_request',
        target: siteId ?? null,
        redirect: null,
        message: INVALID_REQUEST_MESSAGE,
        data: null,
      },
      { status: 400 },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    snapshot?: unknown;
    comment?: unknown;
  } | null;

  if (!payload || payload.snapshot === undefined || payload.snapshot === null) {
    return createSiteManagementActionJsonResponse(
      {
        ok: false,
        code: 'invalid_site_update_request',
        target: siteId,
        redirect: null,
        message: INVALID_REQUEST_MESSAGE,
        data: null,
      },
      { status: 400 },
    );
  }

  if (
    payload.comment !== undefined &&
    payload.comment !== null &&
    typeof payload.comment !== 'string'
  ) {
    return createSiteManagementActionJsonResponse(
      {
        ok: false,
        code: 'invalid_site_update_request',
        target: siteId,
        redirect: null,
        message: INVALID_REQUEST_MESSAGE,
        data: null,
      },
      { status: 400 },
    );
  }

  const response = await proxySiteManagementRequest(request, `/api/management/sites/${siteId}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      snapshot: payload.snapshot,
      comment: payload.comment ?? null,
    }),
  });

  if (response.status === 401) {
    return createSiteManagementActionJsonResponse(
      {
        ok: false,
        code: 'unauthorized',
        target: siteId,
        redirect: getManagedSiteLoginRedirect(siteId),
        message: '登录状态已过期，请重新登录。',
        data: null,
      },
      { status: 401 },
    );
  }

  if (!response.ok) {
    const message = await readSiteManagementApiErrorMessage(response, UPDATE_FAILURE_MESSAGE);

    return createSiteManagementActionJsonResponse(
      {
        ok: false,
        code: 'site_update_failed',
        target: siteId,
        redirect: null,
        message,
        data: null,
      },
      { status: response.status },
    );
  }

  const data = await readSiteManagementEnvelopeData<{ site_id: string }>(response);

  if (!data) {
    return createSiteManagementActionJsonResponse(
      {
        ok: false,
        code: 'request_failed',
        target: siteId,
        redirect: null,
        message: UPDATE_FAILURE_MESSAGE,
        data: null,
      },
      { status: 502 },
    );
  }

  return createSiteManagementActionJsonResponse({
    ok: true,
    status: 'site_updated',
    target: siteId,
    code: undefined,
    redirect: null,
    message: '',
    data,
  });
};
