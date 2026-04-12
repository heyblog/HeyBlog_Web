import type { SiteAuditSnapshot } from '@zhblogs/db';

import { normalizeManagementSiteSnapshot } from '@/domain/sites/service/site-management-snapshot.service';
import { normalizeSubTagSnapshots } from '@/domain/sites/service/site-snapshot.service';

function rewriteMergedValue(value: unknown, sourceTagId: string, targetTagId: string): unknown {
  if (value === sourceTagId) {
    return targetTagId;
  }

  if (Array.isArray(value)) {
    const mapped = value.map((entry) => rewriteMergedValue(entry, sourceTagId, targetTagId));
    return [...new Set(mapped.map((entry) => JSON.stringify(entry)))].map((entry) =>
      JSON.parse(entry),
    );
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        rewriteMergedValue(entry, sourceTagId, targetTagId),
      ]),
    );
  }

  return value;
}

export function rewriteDiffValueForTagMerge(
  value: unknown,
  sourceTagId: string,
  targetTagId: string,
): unknown {
  return rewriteMergedValue(value, sourceTagId, targetTagId);
}

export function rewriteSnapshotForTagMerge(
  snapshot: SiteAuditSnapshot | null,
  sourceTagId: string,
  targetTagId: string,
  tagType: 'MAIN' | 'SUB' | 'WARNING',
): SiteAuditSnapshot | null {
  if (!snapshot) {
    return null;
  }

  const nextSnapshot: SiteAuditSnapshot = { ...snapshot };

  if (tagType === 'MAIN' && snapshot.main_tag?.tag_id === sourceTagId) {
    nextSnapshot.main_tag = {
      ...snapshot.main_tag,
      tag_id: targetTagId,
    };
  }

  if (tagType === 'SUB') {
    nextSnapshot.sub_tags = normalizeSubTagSnapshots(
      (snapshot.sub_tags ?? []).map((item) =>
        item.tag_id === sourceTagId
          ? {
              ...item,
              tag_id: targetTagId,
            }
          : item,
      ),
    );
  }

  return normalizeManagementSiteSnapshot(nextSnapshot);
}
