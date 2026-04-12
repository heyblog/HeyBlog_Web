const DEFAULT_FAILURE_MESSAGE = '请求未完成，请稍后重试。';

const normalizeMessage = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || fallback;
};

export interface ManagementActionResult<T = unknown> {
  ok: boolean;
  code: string;
  status: string | null;
  message: string;
  redirect: string | null;
  data: T | null;
}

const parseManagementActionResponse = async <T>(
  response: Response,
): Promise<ManagementActionResult<T>> => {
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    code?: string;
    status?: string;
    message?: string;
    redirect?: string;
    data?: T;
  } | null;

  return {
    ok: payload?.ok === true,
    code: typeof payload?.code === 'string' ? payload.code : 'request_failed',
    status: typeof payload?.status === 'string' ? payload.status : null,
    message: normalizeMessage(
      payload?.message,
      payload?.ok === true ? '' : DEFAULT_FAILURE_MESSAGE,
    ),
    redirect: typeof payload?.redirect === 'string' ? payload.redirect : null,
    data: payload?.data ?? null,
  };
};

const postJsonAction = async <T>(
  path: string,
  body: unknown,
): Promise<ManagementActionResult<T>> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return parseManagementActionResponse<T>(response);
};

export const submitSiteUpdateAction = (
  siteId: string,
  body: {
    snapshot: unknown;
    comment?: string | null;
  },
): Promise<ManagementActionResult<{ site_id: string }>> =>
  postJsonAction(`/management/sites/${siteId}/update`, body);

export const submitAuditReviewAction = (
  auditId: string,
  body: {
    decision: 'APPROVED' | 'REJECTED';
    reviewer_comment?: string | null;
    snapshot_override?: unknown;
  },
): Promise<
  ManagementActionResult<{
    audit_id: string;
    action: string;
    status: string;
    site_id: string | null;
  }>
> => postJsonAction(`/management/site-submissions/${auditId}/review`, body);
