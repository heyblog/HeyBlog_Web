import type {
  CreateSubmissionFormState,
  DeleteSubmissionFormState,
  FeedDraft,
  FeedType,
  FieldErrors,
  QuerySubmissionFormState,
  RestoreSubmissionFormState,
  SiteResolveResult,
  SubTagInput,
  UpdateSubmissionFormState,
} from './site-submission.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createDraftId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeFeedType = (value: string | null | undefined): FeedType =>
  value === 'ATOM' || value === 'JSON' ? value : 'RSS';

const createFeedDraft = (
  name = '',
  url = '',
  isDefault = false,
  type: FeedDraft['type'] = 'RSS',
): FeedDraft => ({
  id: createDraftId(),
  name,
  url,
  type,
  isDefault,
});

const createBaseContactState = () => ({
  submitter_name: '',
  submitter_email: '',
  submit_reason: '',
  notify_by_email: false,
  agree_terms: false,
});

const createBaseSiteState = () => {
  const feed = createFeedDraft('', '', true);
  return {
    name: '',
    url: 'https://',
    sign: '',
    main_tag_id: '',
    sub_tags: [] as SubTagInput[],
    feeds: [feed],
    sitemap: '',
    link_page: '',
    architecture_program_id: '',
    architecture_program_name: '',
    architecture_program_is_open_source: null,
    architecture_framework_ids: [],
    architecture_framework_custom_names: [],
    architecture_language_ids: [],
    architecture_language_custom_names: [],
    architecture_website_url: '',
    architecture_repo_url: '',
  };
};

export function createInitialCreateForm(): CreateSubmissionFormState {
  return {
    ...createBaseContactState(),
    ...createBaseSiteState(),
  };
}

export function createInitialUpdateForm(): UpdateSubmissionFormState {
  return {
    ...createBaseContactState(),
    ...createBaseSiteState(),
    site_identifier: '',
  };
}

export function createInitialDeleteForm(): DeleteSubmissionFormState {
  return {
    ...createBaseContactState(),
    site_identifier: '',
  };
}

export function createInitialQueryForm(
  initial: Partial<QuerySubmissionFormState> = {},
): QuerySubmissionFormState {
  return {
    audit_id: initial.audit_id ?? '',
  };
}

export function createInitialRestoreForm(): RestoreSubmissionFormState {
  return {
    submitter_name: '',
    submitter_email: '',
    restore_reason: '',
    notify_by_email: false,
    agree_terms: false,
  };
}

export function createEmptyFeedDraft(): FeedDraft {
  return createFeedDraft('', '', false);
}

export function trimText(value: string): string {
  return value.trim();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(trimText(value));
}

export function isHttpUrl(value: string): boolean {
  try {
    const target = new URL(trimText(value));
    return target.protocol === 'http:' || target.protocol === 'https:';
  } catch {
    return false;
  }
}

export function createComparableHttpUrlKey(value: string | null | undefined): string | null {
  const normalized = trimText(value ?? '');

  if (!normalized) {
    return null;
  }

  try {
    const target = new URL(normalized);

    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return null;
    }

    target.hostname = target.hostname.toLowerCase();
    target.hash = '';

    if (
      (target.protocol === 'http:' && target.port === '80') ||
      (target.protocol === 'https:' && target.port === '443')
    ) {
      target.port = '';
    }

    if (target.pathname !== '/') {
      target.pathname = target.pathname.replace(/\/+$/u, '') || '/';
    }

    return target.toString();
  } catch {
    return null;
  }
}

export function ensureSingleDefaultFeedDrafts<T extends { id: string; isDefault: boolean }>(
  feeds: T[],
  selectedId?: string | null,
): T[] {
  if (feeds.length === 0) {
    return [];
  }

  if (feeds.length === 1) {
    return feeds.map((feed) => ({
      ...feed,
      isDefault: true,
    }));
  }

  const fallbackId = feeds.find((feed) => feed.isDefault)?.id ?? feeds[0]?.id ?? null;
  const targetId =
    selectedId && feeds.some((feed) => feed.id === selectedId) ? selectedId : fallbackId;

  return feeds.map((feed) => ({
    ...feed,
    isDefault: feed.id === targetId,
  }));
}

export function mapApiFieldErrors(fields: string[] | undefined): FieldErrors {
  if (!fields || fields.length === 0) {
    return {};
  }

  const mapped: FieldErrors = {};

  for (const field of fields) {
    const normalized = field.replace(/^site\./, '').replace(/^changes\./, '');

    if (normalized === 'main_tag_id' || normalized === 'sub_tags') {
      mapped.main_tag_id = '分类信息无效，请重新选择。';
      continue;
    }

    if (normalized === 'architecture') {
      mapped.architecture_program_name = '架构信息无效，请检查后重试。';
      continue;
    }

    if (normalized === 'feed') {
      mapped.feeds = '请检查订阅地址后重试。';
      continue;
    }

    mapped[normalized] = '请检查该字段后重试。';
  }

  return mapped;
}

export function formatAuditTime(value: string | null): string {
  if (!value) {
    return '尚未处理';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function patchByUrl(currentUrl: string, fallbackPath: string): string {
  const normalized = trimText(currentUrl);

  if (!isHttpUrl(normalized)) {
    return '';
  }

  try {
    const url = new URL(normalized);
    url.pathname = fallbackPath;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function guessDefaultFeedUrl(siteUrl: string): string {
  return patchByUrl(siteUrl, '/feed');
}

export function guessDefaultSitemapUrl(siteUrl: string): string {
  return patchByUrl(siteUrl, '/sitemap.xml');
}

export function guessDefaultLinkPageUrl(siteUrl: string): string {
  return patchByUrl(siteUrl, '/friends');
}

export function createUpdateFormFromResolvedSite(
  site: SiteResolveResult,
): UpdateSubmissionFormState {
  const feeds = ensureSingleDefaultFeedDrafts(
    site.feed.length > 0
      ? site.feed.map((item, index) => ({
          id: createDraftId(),
          name: trimText(item.name) || (site.feed.length === 1 && index === 0 ? '默认订阅' : ''),
          url: trimText(item.url),
          type: normalizeFeedType(item.type),
          isDefault: item.isDefault === true,
        }))
      : [createFeedDraft('', trimText(site.url), true)],
  );

  return {
    ...createBaseContactState(),
    site_identifier: site.site_id,
    name: site.name,
    url: site.url,
    sign: site.sign,
    main_tag_id: site.main_tag_id ?? '',
    sub_tags: (site.sub_tags ?? []).map((item) => ({ ...item })),
    feeds,
    sitemap: site.sitemap ?? '',
    link_page: site.link_page ?? '',
    architecture_program_id: site.architecture?.program_id ?? '',
    architecture_program_name: site.architecture?.program_name ?? '',
    architecture_program_is_open_source: site.architecture?.program_is_open_source ?? null,
    architecture_framework_ids: (site.architecture?.stacks ?? [])
      .filter((item) => item.category === 'FRAMEWORK')
      .map((item) => trimText(item.catalog_id ?? ''))
      .filter(Boolean),
    architecture_framework_custom_names: (site.architecture?.stacks ?? [])
      .filter((item) => item.category === 'FRAMEWORK')
      .filter((item) => !trimText(item.catalog_id ?? ''))
      .map((item) => trimText(item.name ?? ''))
      .filter(Boolean),
    architecture_language_ids: (site.architecture?.stacks ?? [])
      .filter((item) => item.category === 'LANGUAGE')
      .map((item) => trimText(item.catalog_id ?? ''))
      .filter(Boolean),
    architecture_language_custom_names: (site.architecture?.stacks ?? [])
      .filter((item) => item.category === 'LANGUAGE')
      .filter((item) => !trimText(item.catalog_id ?? ''))
      .map((item) => trimText(item.name ?? ''))
      .filter(Boolean),
    architecture_website_url: site.architecture?.website_url ?? '',
    architecture_repo_url: site.architecture?.repo_url ?? '',
  };
}
