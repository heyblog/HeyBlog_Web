import type {
  SiteAuditArchitectureSnapshot,
  SiteAuditDiffItem,
  SiteAuditSnapshot,
} from '@zhblogs/db';

export type EditableArchitectureInput = {
  program_id?: string | null;
  program_name?: string | null;
  program_is_open_source?: boolean | null;
  stacks?: Array<{
    category: 'FRAMEWORK' | 'LANGUAGE';
    catalog_id?: string | null;
    name?: string | null;
    name_normalized?: string | null;
  }> | null;
  website_url?: string | null;
  repo_url?: string | null;
};

export type EditableSubTagInput = {
  tag_id?: string | null;
  name?: string | null;
  name_normalized?: string | null;
};

export type EditableTagInput = NonNullable<SiteAuditSnapshot['main_tag']>;

const normalizeOptionalText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
};

const normalizeComparableStringList = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = [
    ...new Set(
      value
        .map((item) => normalizeOptionalText(item))
        .filter((item): item is string => Boolean(item)),
    ),
  ];
  return normalized.length > 0 ? normalized.sort() : null;
};

export const normalizeSubTagToken = (value: string | null | undefined): string | null => {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  const compact = normalized.toLocaleLowerCase('zh-CN').replace(/[^\p{L}\p{N}]+/gu, '');
  return compact || normalized.toLocaleLowerCase('zh-CN');
};

export function normalizeTagSnapshot(
  tag: EditableTagInput | null | undefined,
): NonNullable<SiteAuditSnapshot['main_tag']> | null {
  if (!tag || typeof tag !== 'object') {
    return null;
  }

  const tag_id = normalizeOptionalText(tag.tag_id);
  const name = normalizeOptionalText(tag.name);
  const name_normalized = normalizeSubTagToken(tag.name_normalized ?? name);

  if (!tag_id && !name) {
    return null;
  }

  if (tag_id) {
    return {
      tag_id,
      name,
      name_normalized,
    };
  }

  if (!name || !name_normalized) {
    return null;
  }

  return {
    tag_id: null,
    name,
    name_normalized,
  };
}

export function normalizeSubTagSnapshots(
  subTags: EditableSubTagInput[] | null | undefined,
): SiteAuditSnapshot['sub_tags'] {
  if (!Array.isArray(subTags)) {
    return null;
  }

  const normalized: NonNullable<SiteAuditSnapshot['sub_tags']> = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const item of subTags) {
    const normalizedTag = normalizeTagSnapshot(item);

    if (!normalizedTag) {
      continue;
    }

    const tag_id = normalizedTag.tag_id;
    const name_normalized = normalizedTag.name_normalized;

    if (tag_id) {
      if (seenIds.has(tag_id)) {
        continue;
      }

      seenIds.add(tag_id);
      normalized.push(normalizedTag);
      continue;
    }

    if (!name_normalized || seenNames.has(name_normalized)) {
      continue;
    }

    seenNames.add(name_normalized);
    normalized.push(normalizedTag);
  }

  normalized.sort((left, right) => {
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

  return normalized.length > 0 ? normalized : null;
}

const normalizeFeedType = (value: unknown): 'ATOM' | 'JSON' | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === 'ATOM' || normalized === 'JSON') {
    return normalized;
  }

  return null;
};

const normalizeComparableFeeds = (value: unknown) => {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const feed = item as { name?: unknown; url?: unknown; type?: unknown };
      const url = normalizeOptionalText(feed.url);

      if (!url) {
        return null;
      }

      return {
        name: normalizeOptionalText(feed.name),
        url,
        type: normalizeFeedType(feed.type),
      };
    })
    .filter((item): item is { name: string | null; url: string; type: 'ATOM' | 'JSON' | null } =>
      Boolean(item),
    )
    .sort((a, b) => {
      if (a.url !== b.url) {
        return a.url.localeCompare(b.url, 'zh-CN');
      }

      if ((a.name ?? '') !== (b.name ?? '')) {
        return (a.name ?? '').localeCompare(b.name ?? '', 'zh-CN');
      }

      return (a.type ?? '').localeCompare(b.type ?? '', 'zh-CN');
    });

  return normalized.length > 0 ? normalized : null;
};

function normalizeComparableValue(field: keyof SiteAuditSnapshot, value: unknown) {
  if (field === 'feed') {
    return normalizeComparableFeeds(value);
  }

  if (field === 'main_tag' && value && typeof value === 'object') {
    return normalizeTagSnapshot(value as EditableTagInput);
  }

  if (field === 'sub_tags' && Array.isArray(value)) {
    return normalizeSubTagSnapshots(value as EditableSubTagInput[]);
  }

  if (field === 'from' && Array.isArray(value)) {
    return normalizeComparableStringList(value);
  }

  if (field === 'architecture' && value && typeof value === 'object') {
    return normalizeArchitectureSnapshot(value as EditableArchitectureInput);
  }

  return value ?? null;
}

export function normalizeArchitectureSnapshot(
  architecture: EditableArchitectureInput | null | undefined,
): SiteAuditArchitectureSnapshot | null {
  if (!architecture) {
    return null;
  }

  const stacks = Array.isArray(architecture.stacks)
    ? architecture.stacks
        .map((item) => {
          const category =
            item.category === 'FRAMEWORK' || item.category === 'LANGUAGE' ? item.category : null;
          const catalog_id = item.catalog_id?.trim() || null;
          const name = item.name?.trim() || null;
          const name_normalized =
            item.name_normalized?.trim() || (name ? name.toLocaleLowerCase('zh-CN') : null);

          if (!category || (!catalog_id && !name)) {
            return null;
          }

          return {
            category,
            catalog_id,
            name,
            name_normalized,
          };
        })
        .filter((item) => item !== null)
        .sort((a, b) => {
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category, 'zh-CN');
          }

          if ((a.catalog_id ?? '') !== (b.catalog_id ?? '')) {
            return (a.catalog_id ?? '').localeCompare(b.catalog_id ?? '', 'zh-CN');
          }

          return (a.name ?? '').localeCompare(b.name ?? '', 'zh-CN');
        })
    : null;

  const normalized: SiteAuditArchitectureSnapshot = {
    program_id: architecture.program_id?.trim() || null,
    program_name: architecture.program_name?.trim() || null,
    program_is_open_source:
      typeof architecture.program_is_open_source === 'boolean'
        ? architecture.program_is_open_source
        : null,
    stacks: stacks && stacks.length > 0 ? stacks : null,
    website_url: architecture.website_url?.trim() || null,
    repo_url: architecture.repo_url?.trim() || null,
  };

  if (
    !normalized.program_id &&
    !normalized.program_name &&
    !normalized.stacks &&
    !normalized.website_url &&
    !normalized.repo_url
  ) {
    return null;
  }

  return normalized;
}

export function buildSnapshotDiff(
  currentSnapshot: SiteAuditSnapshot | null,
  proposedSnapshot: SiteAuditSnapshot,
): SiteAuditDiffItem[] {
  const fields: Array<keyof SiteAuditSnapshot> = [
    'bid',
    'name',
    'url',
    'sign',
    'icon_base64',
    'feed',
    'from',
    'classification_status',
    'sitemap',
    'link_page',
    'access_scope',
    'status',
    'is_show',
    'recommend',
    'reason',
    'main_tag',
    'sub_tags',
    'architecture',
  ];

  const diff: SiteAuditDiffItem[] = [];

  for (const field of fields) {
    const before = normalizeComparableValue(field, currentSnapshot?.[field]);
    const after = normalizeComparableValue(field, proposedSnapshot[field]);

    if (JSON.stringify(before) === JSON.stringify(after)) {
      continue;
    }

    diff.push({
      field,
      before,
      after,
    });
  }

  return diff;
}
