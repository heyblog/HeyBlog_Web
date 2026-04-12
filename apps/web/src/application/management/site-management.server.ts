import { getApiBaseUrl } from '@/application/auth/auth.server';

const ENTITY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MESSAGE_MAX_LENGTH = 160;

type ErrorPayload = {
  code?: string;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

const STATUS_FALLBACK_MESSAGES: Record<number, string> = {
  400: '请求参数无效，请刷新后重试。',
  401: '登录状态已过期，请重新登录。',
  403: '当前账号无权执行这次站点管理操作。',
  404: '目标站点或审核记录不存在。',
  409: '目标状态已变化，请刷新后重试。',
};

const normalizeFeedbackMessage = (value: string): string =>
  value.replace(/\s+/g, ' ').trim().slice(0, MESSAGE_MAX_LENGTH);

const pickMessageFromPayload = (payload: ErrorPayload | null): string | null => {
  const message = payload?.error?.message ?? payload?.message;

  if (!message?.trim()) {
    return null;
  }

  return normalizeFeedbackMessage(message);
};

export const isValidManagedSiteId = (value: string | null | undefined): value is string =>
  typeof value === 'string' && ENTITY_ID_PATTERN.test(value);

export const proxySiteManagementRequest = (
  request: Request,
  path: string,
  init: RequestInit,
): Promise<Response> =>
  fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      cookie: request.headers.get('cookie') ?? '',
      ...(init.headers ?? {}),
    },
  });

export const readSiteManagementApiErrorMessage = async (
  response: Response,
  fallbackMessage: string,
): Promise<string> => {
  try {
    const payload = (await response.json()) as ErrorPayload;
    const parsedMessage = pickMessageFromPayload(payload);

    if (parsedMessage) {
      return parsedMessage;
    }
  } catch {
    // Ignore parse errors and fallback to status message mapping.
  }

  return STATUS_FALLBACK_MESSAGES[response.status] ?? fallbackMessage;
};

export const readSiteManagementEnvelopeData = async <T>(response: Response): Promise<T | null> => {
  try {
    const payload = (await response.json()) as {
      data?: T;
    };

    return payload?.data ?? null;
  } catch {
    return null;
  }
};

export const createSiteManagementActionJsonResponse = (
  payload: {
    ok: boolean;
    status?: string | null;
    target?: string | null;
    message?: string | null;
    code?: string | null;
    redirect?: string | null;
    data?: unknown;
  },
  init: ResponseInit = {},
): Response =>
  new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers ?? {}),
    },
  });

export const getManagedSiteLoginRedirect = (siteId: string): string =>
  `/login?next=${encodeURIComponent(`/management/sites/${siteId}`)}`;

export const getManagedSiteAuditProcessLoginRedirect = (auditId: string): string =>
  `/login?next=${encodeURIComponent(`/management/site-submissions/${auditId}/process`)}`;
