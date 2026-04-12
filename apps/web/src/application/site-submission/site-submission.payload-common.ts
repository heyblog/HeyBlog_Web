import { isHttpUrl, isUuid, isValidEmail, normalizeEmail, trimText } from './site-submission.core';
import type { FeedInput, FeedType, FieldErrors, SubTagInput } from './site-submission.types';

export type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

export type ValidationFailure = {
  ok: false;
  fieldErrors: FieldErrors;
  formError?: string;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const normalizeFeedType = (value: FeedInput['type']): FeedType =>
  value === 'ATOM' || value === 'JSON' ? value : 'RSS';

type ContactFormLike = {
  submitter_name: string;
  submitter_email: string;
  submit_reason: string;
  notify_by_email: boolean;
  agree_terms: boolean;
};

export function normalizeComparableUrl(value: string): string | null {
  if (!isHttpUrl(value)) {
    return null;
  }

  try {
    const parsed = new URL(trimText(value));
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.origin}${pathname}`.toLowerCase();
  } catch {
    return null;
  }
}

export function isSameAsSiteUrl(siteUrl: string, candidateUrl: string): boolean {
  const site = normalizeComparableUrl(siteUrl);
  const candidate = normalizeComparableUrl(candidateUrl);

  if (!site || !candidate) {
    return false;
  }

  return site === candidate;
}

export function normalizeStringList(values: string[]): string[] {
  return [...new Set(values.map((value) => trimText(value)).filter(Boolean))].sort();
}

export function normalizeSubTagToken(value: string | null | undefined): string | null {
  const normalized = trimText(value ?? '');

  if (!normalized) {
    return null;
  }

  const compact = normalized.toLocaleLowerCase('zh-CN').replace(/[^\p{L}\p{N}]+/gu, '');
  return compact || normalized.toLocaleLowerCase('zh-CN');
}

export function normalizeSubTagInputs(values: SubTagInput[]): SubTagInput[] {
  const normalized: SubTagInput[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const item of values) {
    const tag_id = trimText(item.tag_id ?? '') || null;
    const name = trimText(item.name ?? '') || null;
    const name_normalized = normalizeSubTagToken(item.name_normalized ?? name);

    if (!tag_id && !name) {
      continue;
    }

    if (tag_id) {
      if (seenIds.has(tag_id)) {
        continue;
      }

      seenIds.add(tag_id);
      normalized.push({
        tag_id,
        name,
        name_normalized,
      });
      continue;
    }

    if (!name || !name_normalized || seenNames.has(name_normalized)) {
      continue;
    }

    seenNames.add(name_normalized);
    normalized.push({
      tag_id: null,
      name,
      name_normalized,
    });
  }

  return normalized.sort((left, right) => {
    const leftHasId = Boolean(left.tag_id);
    const rightHasId = Boolean(right.tag_id);

    if (leftHasId !== rightHasId) {
      return leftHasId ? -1 : 1;
    }

    if ((left.tag_id ?? '') !== (right.tag_id ?? '')) {
      return (left.tag_id ?? '').localeCompare(right.tag_id ?? '', 'zh-CN');
    }

    return (left.name_normalized ?? '').localeCompare(right.name_normalized ?? '', 'zh-CN');
  });
}

export function normalizeResolvedFeed(
  feed: FeedInput[],
): Array<{ name: string; url: string; type: 'RSS' | 'ATOM' | 'JSON'; isDefault: boolean }> {
  return feed
    .map((item, index) => ({
      name: trimText(item.name) || (feed.length === 1 && index === 0 ? '默认订阅' : ''),
      url: trimText(item.url),
      type: normalizeFeedType(item.type),
      isDefault: feed.length === 1 ? true : item.isDefault === true,
    }))
    .filter((item) => item.url.length > 0);
}

export function areEqualJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateContactFields(
  form: ContactFormLike,
  fieldErrors: FieldErrors,
  options: {
    requireReason: boolean;
    reasonMessage: string;
  },
): void {
  if (trimText(form.submitter_email) && !isValidEmail(form.submitter_email)) {
    fieldErrors.submitter_email = '提交者邮箱格式不正确。';
  }

  if (options.requireReason && !trimText(form.submit_reason)) {
    fieldErrors.submit_reason = options.reasonMessage;
  }

  if (!form.agree_terms) {
    fieldErrors.agree_terms = '请先勾选同意协议。';
  }
}

export function normalizeSubmitterName(value: string): string | null {
  return trimText(value) || null;
}

export function normalizeOptionalSubmitterEmail(value: string): string | null {
  const normalized = normalizeEmail(value);
  return normalized && isValidEmail(normalized) ? normalized : null;
}

export function toLookupPayload(identifier: string) {
  const normalized = trimText(identifier);

  if (!normalized) {
    return null;
  }

  if (isUuid(normalized)) {
    return { site_id: normalized };
  }

  if (isHttpUrl(normalized)) {
    return { url: normalized };
  }

  return { bid: normalized };
}
