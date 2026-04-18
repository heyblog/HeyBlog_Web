import type { SiteAuditSnapshot } from '@zhblogs/db';

import { describe, expect, it } from 'vitest';

import { buildSnapshotDiff } from '@/domain/sites/service/site-snapshot.service';

function createSnapshot(overrides: Partial<SiteAuditSnapshot> = {}): SiteAuditSnapshot {
  return {
    bid: null,
    name: 'Example Blog',
    url: 'https://example.com',
    sign: null,
    icon_base64: null,
    feed: null,
    from: ['WEB_SUBMIT'],
    classification_status: 'COMPLETE',
    sitemap: null,
    link_page: null,
    access_scope: 'ALL',
    status: 'OK',
    is_show: true,
    recommend: false,
    reason: null,
    main_tag: null,
    sub_tags: null,
    architecture: null,
    ...overrides,
  };
}

describe('buildSnapshotDiff', () => {
  it('ignores optional empty text fields when values only differ by empty string and null', () => {
    const currentSnapshot = createSnapshot({
      sign: '',
      sitemap: '   ',
      link_page: '',
      reason: '',
    });
    const proposedSnapshot = createSnapshot({
      sign: null,
      sitemap: null,
      link_page: null,
      reason: null,
    });

    expect(buildSnapshotDiff(currentSnapshot, proposedSnapshot)).toEqual([]);
  });

  it('still keeps real sign changes in diff output', () => {
    const currentSnapshot = createSnapshot({ sign: '' });
    const proposedSnapshot = createSnapshot({ sign: '新的站点简介' });

    expect(buildSnapshotDiff(currentSnapshot, proposedSnapshot)).toEqual([
      {
        field: 'sign',
        before: null,
        after: '新的站点简介',
      },
    ]);
  });
});
