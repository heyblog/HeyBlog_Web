import type { FeedTypeKey, SiteSnapshotDraft } from './site-management.snapshot.types';

export const SITE_STATUS_OPTIONS: Array<{ value: SiteSnapshotDraft['status']; label: string }> = [
  { value: 'OK', label: '正常' },
  { value: 'ERROR', label: '异常' },
  { value: 'SSLERROR', label: 'SSL 证书错误' },
];

export const SITE_CLASSIFICATION_STATUS_OPTIONS: Array<{
  value: SiteSnapshotDraft['classification_status'];
  label: string;
}> = [
  { value: 'COMPLETE', label: '分类完整' },
  { value: 'NEEDS_REVIEW', label: '待完善分类' },
];

export const SITE_ACCESS_SCOPE_OPTIONS: Array<{
  value: SiteSnapshotDraft['access_scope'];
  label: string;
}> = [
  { value: 'BOTH', label: '国内外可访问' },
  { value: 'CN_ONLY', label: '仅国内可访问' },
  { value: 'GLOBAL_ONLY', label: '仅海外可访问' },
];

export const FEED_TYPE_OPTIONS: Array<{ value: FeedTypeKey; label: string }> = [
  { value: 'RSS', label: 'RSS' },
  { value: 'ATOM', label: 'Atom' },
  { value: 'JSON', label: 'JSON Feed' },
];

export const FROM_SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'WEB_SUBMIT', label: '网页提交' },
  { value: 'LINK_PAGE_SEARCH', label: '友链发现' },
  { value: 'CIB', label: '中文独立博客列表' },
  { value: 'BO_YOU_QUAN', label: '博友圈' },
  { value: 'BLOG_FINDER', label: 'BlogFinder' },
  { value: 'BKZ', label: '优秀个人独立博客导航' },
  { value: 'TRAVELLINGS', label: '开往' },
  { value: 'OLD_DATA', label: '旧版数据迁移' },
];
