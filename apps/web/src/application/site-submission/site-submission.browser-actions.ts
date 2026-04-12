import { openSubmissionToast } from '@/shared/browser/submission-toast.service';

import { getJson, postJson } from './site-submission.browser-http';
import { evaluateAutoFillResult } from './site-submission.browser-workspace';
import { getLookupPayload, type SiteResolveRequest } from './site-submission.service';
import {
  type ActiveSubmissionSummary,
  type FieldErrors,
  mapApiFieldErrors,
  type SiteAutoFillResult,
  type SiteResolveResult,
  type SiteSearchItem,
  type SiteSubmissionOptionsResult,
  type SubmissionDuplicateReviewPayload,
  type SubmissionResult,
  type SubmissionStatusResult,
} from './site-submission.service';

export type SubmissionMutationEndpoint =
  | '/api/site-submissions/create'
  | '/api/site-submissions/restore'
  | '/api/site-submissions/update'
  | '/api/site-submissions/delete';

export interface SubmissionMutationError {
  code: string;
  message: string;
  fieldErrors: FieldErrors;
  duplicateReview?: SubmissionDuplicateReviewPayload;
  activeSubmission?: ActiveSubmissionSummary;
}

export async function requestSubmissionOptions(
  activePage: string,
): Promise<SiteSubmissionOptionsResult | null> {
  if (activePage === 'query' || activePage === 'restore') {
    return null;
  }

  try {
    const response = await getJson<SiteSubmissionOptionsResult>('/api/site-submissions/options');

    if (response.ok) {
      const frameworks = (response.data.tech_stacks ?? []).filter(
        (item) => item.category === 'FRAMEWORK',
      );
      const languages = (response.data.tech_stacks ?? []).filter(
        (item) => item.category === 'LANGUAGE',
      );

      return {
        ...response.data,
        tech_stacks: [...frameworks, ...languages],
      };
    }

    openSubmissionToast({
      tone: 'warning',
      title: '选项加载不完整',
      message: response.error.message,
    });
    return null;
  } catch {
    openSubmissionToast({
      tone: 'warning',
      title: '选项加载不完整',
      message: '选项加载失败，请稍后重试。',
    });
    return null;
  }
}

export async function requestResolvedSite(
  target: string | SiteResolveRequest,
): Promise<{ ok: true; data: SiteResolveResult } | { ok: false; error: string }> {
  const lookup = typeof target === 'string' ? getLookupPayload(target) : target;

  if (!lookup) {
    return { ok: false, error: '请填写站点 ID、完整 URL 或 bid。' };
  }

  try {
    const response = await postJson<SiteResolveResult>('/api/site-submissions/resolve', lookup);

    if (!response.ok) {
      openSubmissionToast({
        tone: 'error',
        title: '站点未载入',
        message: response.error.message,
      });
      return { ok: false, error: response.error.message };
    }

    return { ok: true, data: response.data };
  } catch {
    const error = '站点解析失败，请稍后重试。';
    openSubmissionToast({
      tone: 'error',
      title: '站点未载入',
      message: error,
    });
    return { ok: false, error };
  }
}

export async function requestSearchSites(
  searchQuery: string,
): Promise<{ ok: true; data: SiteSearchItem[] } | { ok: false; error: string }> {
  try {
    const response = await postJson<SiteSearchItem[]>('/api/site-submissions/search', {
      query: searchQuery,
    });

    if (response.ok) {
      if (response.data.length === 0) {
        const error = '没有找到匹配的站点，请改用更完整的地址或唯一标识。';
        openSubmissionToast({
          tone: 'warning',
          title: '没有找到匹配站点',
          message: error,
        });
      }

      return { ok: true, data: response.data };
    }

    openSubmissionToast({
      tone: 'error',
      title: '搜索失败',
      message: response.error.message,
    });
    return { ok: false, error: response.error.message };
  } catch {
    const error = '搜索服务暂时不可用，请稍后重试。';
    openSubmissionToast({
      tone: 'error',
      title: '搜索失败',
      message: error,
    });
    return { ok: false, error };
  }
}

export async function requestSiteAutoFill(url: string): Promise<
  | {
      ok: true;
      data: SiteAutoFillResult;
      evaluation: ReturnType<typeof evaluateAutoFillResult>;
    }
  | { ok: false }
> {
  try {
    const response = await postJson<SiteAutoFillResult>('/api/site-submissions/auto-fill', { url });

    if (!response.ok) {
      openSubmissionToast({
        tone: 'error',
        title: '自动抓取失败',
        message: '获取失败，请手动填写或稍后重试。',
      });
      return { ok: false };
    }

    return {
      ok: true,
      data: response.data,
      evaluation: evaluateAutoFillResult(response.data),
    };
  } catch {
    openSubmissionToast({
      tone: 'error',
      title: '自动抓取失败',
      message: '获取失败，请手动填写或稍后重试。',
    });
    return { ok: false };
  }
}

export async function requestSubmissionMutation(params: {
  endpoint: SubmissionMutationEndpoint;
  payload: unknown;
  successTitle: string;
  errorTitle: string;
  suppressToastCodes?: string[];
}): Promise<{ ok: true; data: SubmissionResult } | { ok: false; error: SubmissionMutationError }> {
  try {
    const response = await postJson<SubmissionResult>(params.endpoint, params.payload);

    if (response.ok) {
      return { ok: true, data: response.data };
    }

    if (!params.suppressToastCodes?.includes(response.error.code)) {
      openSubmissionToast({
        tone: 'error',
        title: params.errorTitle,
        message: response.error.message,
      });
    }

    return {
      ok: false,
      error: {
        code: response.error.code,
        message: response.error.message,
        fieldErrors: mapApiFieldErrors(response.error.fields),
        duplicateReview: response.error.duplicate_review,
        activeSubmission: response.error.active_submission,
      },
    };
  } catch {
    openSubmissionToast({
      tone: 'error',
      title: params.errorTitle,
      message: '提交服务暂时不可用，请稍后重试。',
    });

    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: '提交服务暂时不可用，请稍后重试。',
        fieldErrors: {},
      },
    };
  }
}

export async function requestSubmissionQuery(
  payload: unknown,
): Promise<
  | { ok: true; data: SubmissionStatusResult }
  | { ok: false; error: string; fieldErrors: FieldErrors }
> {
  try {
    const response = await postJson<SubmissionStatusResult>('/api/site-submissions/query', payload);

    if (response.ok) {
      return { ok: true, data: response.data };
    }

    openSubmissionToast({
      tone: 'error',
      title: '查询失败',
      message: response.error.message,
    });

    return {
      ok: false,
      error: response.error.message,
      fieldErrors: mapApiFieldErrors(response.error.fields),
    };
  } catch {
    const error = '查询服务暂时不可用，请稍后重试。';
    openSubmissionToast({
      tone: 'error',
      title: '查询失败',
      message: error,
    });

    return {
      ok: false,
      error,
      fieldErrors: {},
    };
  }
}
