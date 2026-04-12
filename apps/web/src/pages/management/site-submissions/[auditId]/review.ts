import type { APIRoute } from 'astro';

import {
  createSiteManagementActionJsonResponse,
  getManagedSiteAuditProcessLoginRedirect,
  isValidManagedSiteId,
  proxySiteManagementRequest,
  readSiteManagementApiErrorMessage,
  readSiteManagementEnvelopeData,
} from '@/application/management/site-management.server';

export const prerender = false;

const INVALID_REQUEST_MESSAGE = '审核请求无效，请刷新后重试。';
const REVIEW_FAILURE_MESSAGE = '审核提交失败，请稍后重试。';

const isJsonRequest = (request: Request): boolean => {
  const contentType = request.headers.get('content-type') ?? '';
  return contentType.includes('application/json');
};

const isValidDecision = (value: unknown): value is 'APPROVED' | 'REJECTED' =>
  value === 'APPROVED' || value === 'REJECTED';

export const POST: APIRoute = async ({ request, params, redirect }) => {
  const auditId = params.auditId;
  const wantsJson = isJsonRequest(request);

  if (!isValidManagedSiteId(auditId)) {
    if (!wantsJson) {
      return new Response('Invalid audit review request', { status: 400 });
    }

    return createSiteManagementActionJsonResponse(
      {
        ok: false,
        code: 'invalid_audit_review_request',
        target: auditId ?? null,
        redirect: null,
        message: INVALID_REQUEST_MESSAGE,
        data: null,
      },
      { status: 400 },
    );
  }

  const parsedBody = wantsJson
    ? ((await request.json().catch(() => null)) as {
        decision?: unknown;
        reviewer_comment?: unknown;
        snapshot_override?: unknown;
      } | null)
    : null;
  const parsedFormData = !wantsJson ? await request.formData() : null;
  const decision = wantsJson ? parsedBody?.decision : parsedFormData?.get('decision');
  const reviewerComment = wantsJson
    ? parsedBody?.reviewer_comment
    : parsedFormData?.get('reviewer_comment');
  const normalizedReviewerComment =
    typeof reviewerComment === 'string' && reviewerComment.trim().length > 0
      ? reviewerComment.trim()
      : null;

  if (
    !isValidDecision(decision) ||
    (decision === 'REJECTED' &&
      (typeof reviewerComment !== 'string' || reviewerComment.trim().length === 0))
  ) {
    if (!wantsJson) {
      return new Response('Invalid audit review request', { status: 400 });
    }

    return createSiteManagementActionJsonResponse(
      {
        ok: false,
        code: 'invalid_audit_review_request',
        target: auditId,
        redirect: null,
        message: INVALID_REQUEST_MESSAGE,
        data: null,
      },
      { status: 400 },
    );
  }

  const response = await proxySiteManagementRequest(
    request,
    `/api/management/site-audits/${auditId}/review`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        decision,
        reviewer_comment: normalizedReviewerComment,
        ...(wantsJson && parsedBody?.snapshot_override !== undefined
          ? {
              snapshot_override: parsedBody.snapshot_override,
            }
          : {}),
      }),
    },
  );

  if (response.status === 401) {
    if (!wantsJson) {
      return redirect(getManagedSiteAuditProcessLoginRedirect(auditId), 302);
    }

    return createSiteManagementActionJsonResponse(
      {
        ok: false,
        code: 'unauthorized',
        target: auditId,
        redirect: getManagedSiteAuditProcessLoginRedirect(auditId),
        message: '登录状态已过期，请重新登录。',
        data: null,
      },
      { status: 401 },
    );
  }

  if (!response.ok) {
    const message = await readSiteManagementApiErrorMessage(response, REVIEW_FAILURE_MESSAGE);

    if (!wantsJson) {
      return new Response(message, { status: response.status });
    }

    return createSiteManagementActionJsonResponse(
      {
        ok: false,
        code: 'audit_review_failed',
        target: auditId,
        redirect: null,
        message,
        data: null,
      },
      { status: response.status },
    );
  }

  if (!wantsJson) {
    return redirect(`/management/site-submissions/${auditId}`, 302);
  }

  const data = await readSiteManagementEnvelopeData<{
    audit_id: string;
    action: string;
    status: string;
    site_id: string | null;
  }>(response);

  if (!data) {
    return createSiteManagementActionJsonResponse(
      {
        ok: false,
        code: 'request_failed',
        target: auditId,
        redirect: null,
        message: REVIEW_FAILURE_MESSAGE,
        data: null,
      },
      { status: 502 },
    );
  }

  return createSiteManagementActionJsonResponse({
    ok: true,
    status: 'reviewed',
    target: auditId,
    code: undefined,
    redirect: null,
    message: '',
    data,
  });
};
