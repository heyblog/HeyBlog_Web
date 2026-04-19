import type {
  CreateSubmissionFormState,
  DeleteSubmissionFormState,
  FeedDraft,
  FeedType,
  QuerySubmissionFormState,
  RestoreSubmissionFormState,
  SiteResolveResult,
  SubTagInput,
  UpdateSubmissionFormState,
} from './site-submission.types';
import { trimText } from './site-submission.validation';

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

export function createUpdateFormFromResolvedSite(
  site: SiteResolveResult,
): UpdateSubmissionFormState {
  const normalizedResolvedFeeds = site.feed
    .map((item, index) => ({
      id: createDraftId(),
      name: trimText(item.name) || (site.feed.length === 1 && index === 0 ? '默认订阅' : ''),
      url: trimText(item.url),
      type: normalizeFeedType(item.type),
      isDefault: item.isDefault === true,
    }))
    .filter((item) => item.url.length > 0);

  const feeds = ensureSingleDefaultFeedDrafts(normalizedResolvedFeeds);

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
