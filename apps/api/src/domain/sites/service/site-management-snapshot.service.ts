import type { SiteAuditSnapshot } from '@zhblogs/db';

import { normalizeSubTagSnapshots } from '@/domain/sites/service/site-snapshot.service';
import { normalizeSubmittedFeeds } from '@/domain/sites/service/site-submission-validation.service';

const normalizeOptionalString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export function normalizeManagementSiteSnapshot(input: SiteAuditSnapshot): SiteAuditSnapshot {
  const mainTag = normalizeSubTagSnapshots(input.main_tag ? [input.main_tag] : null)?.[0] ?? null;

  return {
    ...input,
    bid: normalizeOptionalString(input.bid),
    name: input.name?.trim() ?? '',
    url: input.url?.trim() ?? '',
    sign: normalizeOptionalString(input.sign),
    icon_base64: normalizeOptionalString(input.icon_base64),
    feed: normalizeSubmittedFeeds(input.feed),
    sitemap: normalizeOptionalString(input.sitemap),
    link_page: normalizeOptionalString(input.link_page),
    reason: normalizeOptionalString(input.reason),
    main_tag: mainTag,
    sub_tags: normalizeSubTagSnapshots(input.sub_tags),
    classification_status: mainTag?.tag_id ? 'COMPLETE' : 'NEEDS_REVIEW',
  };
}
