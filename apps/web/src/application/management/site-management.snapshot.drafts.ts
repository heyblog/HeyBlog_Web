import { ensureSingleDefaultFeedSelection } from '@/application/site-submission/site-feed-draft';

import type {
  SiteArchitectureSnapshot,
  SiteAuditSnapshot,
  SiteFeedDraft,
  SiteSnapshotDraft,
  SiteSubTagSnapshot,
} from './site-management.snapshot.types';

const newDraftId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const trimText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeStringList = (values: readonly unknown[]): string[] => [
  ...new Set(values.map((value) => trimText(value)).filter(Boolean)),
];

const toNullableLowerCaseName = (value: string): string | null => {
  const normalized = trimText(value);
  return normalized ? normalized.toLocaleLowerCase('zh-CN') : null;
};

const normalizeSubTagToken = (value: string | null | undefined): string | null => {
  const normalized = trimText(value ?? '');

  if (!normalized) {
    return null;
  }

  const compact = normalized.toLocaleLowerCase('zh-CN').replace(/[^\p{L}\p{N}]+/gu, '');
  return compact || normalized.toLocaleLowerCase('zh-CN');
};

const normalizeSubTags = (values: readonly SiteSubTagSnapshot[]): SiteSubTagSnapshot[] => {
  const normalized: SiteSubTagSnapshot[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const item of values) {
    const tag_id = trimText(item?.tag_id);
    const name = trimText(item?.name);
    const name_normalized = normalizeSubTagToken(item?.name_normalized ?? name);

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
        name: name || null,
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
};

const isSnapshotArchitecture = (
  value: SiteAuditSnapshot['architecture'],
): value is NonNullable<SiteAuditSnapshot['architecture']> =>
  Boolean(value && typeof value === 'object');

export const createEmptyFeedDraft = (): SiteFeedDraft => ({
  id: newDraftId(),
  name: '',
  url: '',
  type: 'RSS',
  isDefault: false,
});

export const createDraftFromSnapshot = (
  snapshot: SiteAuditSnapshot | null | undefined,
): SiteSnapshotDraft => {
  const architecture = isSnapshotArchitecture(snapshot?.architecture)
    ? snapshot.architecture
    : null;
  const stacks = architecture?.stacks ?? [];

  return {
    bid: trimText(snapshot?.bid),
    name: trimText(snapshot?.name),
    url: trimText(snapshot?.url),
    sign: trimText(snapshot?.sign),
    icon_base64: trimText(snapshot?.icon_base64),
    classification_status:
      snapshot?.classification_status === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : 'COMPLETE',
    sitemap: trimText(snapshot?.sitemap),
    link_page: trimText(snapshot?.link_page),
    reason: trimText(snapshot?.reason),
    is_show: snapshot?.is_show ?? true,
    recommend: snapshot?.recommend ?? false,
    access_scope:
      snapshot?.access_scope === 'CN_ONLY' || snapshot?.access_scope === 'GLOBAL_ONLY'
        ? snapshot.access_scope
        : 'BOTH',
    status:
      snapshot?.status === 'ERROR' || snapshot?.status === 'SSLERROR' ? snapshot.status : 'OK',
    from: normalizeStringList(snapshot?.from ?? ['WEB_SUBMIT']),
    main_tag_id: trimText(snapshot?.main_tag?.tag_id),
    sub_tags: normalizeSubTags(snapshot?.sub_tags ?? []),
    feeds: ensureSingleDefaultFeedSelection(
      snapshot?.feed?.length
        ? snapshot.feed.map((item) => ({
            id: newDraftId(),
            name: trimText(item?.name),
            url: trimText(item?.url),
            type: item?.type === 'ATOM' || item?.type === 'JSON' ? item.type : 'RSS',
            isDefault: item?.isDefault === true,
          }))
        : [],
    ),
    architecture_program_id: trimText(architecture?.program_id),
    architecture_program_name: trimText(architecture?.program_name),
    architecture_program_is_open_source:
      architecture?.program_is_open_source === true
        ? true
        : architecture?.program_is_open_source === false
          ? false
          : null,
    architecture_framework_ids: normalizeStringList(
      stacks
        .filter((item) => item?.category === 'FRAMEWORK')
        .map((item) => trimText(item?.catalog_id)),
    ),
    architecture_framework_custom_names: normalizeStringList(
      stacks
        .filter((item) => item?.category === 'FRAMEWORK' && !trimText(item?.catalog_id))
        .map((item) => trimText(item?.name)),
    ),
    architecture_language_ids: normalizeStringList(
      stacks
        .filter((item) => item?.category === 'LANGUAGE')
        .map((item) => trimText(item?.catalog_id)),
    ),
    architecture_language_custom_names: normalizeStringList(
      stacks
        .filter((item) => item?.category === 'LANGUAGE' && !trimText(item?.catalog_id))
        .map((item) => trimText(item?.name)),
    ),
    architecture_website_url: trimText(architecture?.website_url),
    architecture_repo_url: trimText(architecture?.repo_url),
  };
};

export const cloneDraft = (draft: SiteSnapshotDraft): SiteSnapshotDraft => ({
  ...draft,
  from: [...draft.from],
  sub_tags: draft.sub_tags.map((item) => ({ ...item })),
  feeds: draft.feeds.map((item) => ({ ...item })),
  architecture_framework_ids: [...draft.architecture_framework_ids],
  architecture_framework_custom_names: [...draft.architecture_framework_custom_names],
  architecture_language_ids: [...draft.architecture_language_ids],
  architecture_language_custom_names: [...draft.architecture_language_custom_names],
});

export const toSnapshotPayload = (draft: SiteSnapshotDraft): SiteAuditSnapshot => {
  const feeds = ensureSingleDefaultFeedSelection(
    draft.feeds
      .map((item, index) => ({
        id: item.id || `feed-${index}`,
        name: trimText(item.name) || '默认订阅',
        url: trimText(item.url),
        type: item.type,
        isDefault: item.isDefault,
      }))
      .filter((item) => item.url),
  ).map(({ id: _id, ...item }) => ({
    name: trimText(item.name) || '默认订阅',
    url: trimText(item.url),
    type: item.type,
    isDefault: item.isDefault,
  }));

  const architectureStacks: NonNullable<NonNullable<SiteArchitectureSnapshot['stacks']>> = [
    ...normalizeStringList(draft.architecture_framework_ids).map((catalogId) => ({
      category: 'FRAMEWORK' as const,
      catalog_id: catalogId,
      name: null,
      name_normalized: null,
    })),
    ...normalizeStringList(draft.architecture_framework_custom_names).map((name) => ({
      category: 'FRAMEWORK' as const,
      catalog_id: null,
      name,
      name_normalized: toNullableLowerCaseName(name),
    })),
    ...normalizeStringList(draft.architecture_language_ids).map((catalogId) => ({
      category: 'LANGUAGE' as const,
      catalog_id: catalogId,
      name: null,
      name_normalized: null,
    })),
    ...normalizeStringList(draft.architecture_language_custom_names).map((name) => ({
      category: 'LANGUAGE' as const,
      catalog_id: null,
      name,
      name_normalized: toNullableLowerCaseName(name),
    })),
  ];

  const programId = trimText(draft.architecture_program_id);
  const programName = trimText(draft.architecture_program_name);
  const architectureWebsite = trimText(draft.architecture_website_url);
  const architectureRepo = trimText(draft.architecture_repo_url);

  const hasArchitecture =
    Boolean(programId) ||
    Boolean(programName) ||
    Boolean(architectureWebsite) ||
    Boolean(architectureRepo) ||
    architectureStacks.length > 0;

  return {
    bid: trimText(draft.bid) || null,
    name: trimText(draft.name),
    url: trimText(draft.url),
    sign: trimText(draft.sign) || null,
    icon_base64: trimText(draft.icon_base64) || null,
    feed: feeds,
    sitemap: trimText(draft.sitemap) || null,
    link_page: trimText(draft.link_page) || null,
    reason: trimText(draft.reason) || null,
    is_show: draft.is_show,
    recommend: draft.recommend,
    access_scope: draft.access_scope,
    status: draft.status,
    from: normalizeStringList(draft.from.length > 0 ? draft.from : ['WEB_SUBMIT']),
    main_tag: trimText(draft.main_tag_id)
      ? {
          tag_id: trimText(draft.main_tag_id),
          name: null,
          name_normalized: null,
        }
      : null,
    sub_tags: normalizeSubTags(draft.sub_tags),
    architecture: hasArchitecture
      ? {
          program_id: programId || null,
          program_name: programName || null,
          program_is_open_source: draft.architecture_program_is_open_source,
          stacks: architectureStacks,
          website_url: architectureWebsite || null,
          repo_url: architectureRepo || null,
        }
      : null,
  };
};
