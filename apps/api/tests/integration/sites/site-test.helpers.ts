import { SiteArchitectures, type SiteAuditSnapshot, Sites, SiteTags } from '@zhblogs/db';

import { vi } from 'vitest';

import type { createTestApp } from '@tests/create-test-app';
import type { QueryStep } from '@tests/fixtures/db-mocks';

export const MANAGEMENT_TEST_IDS = {
  siteId: '11111111-1111-4111-8111-111111111111',
  auditId: '22222222-2222-4222-8222-222222222222',
  actorId: '33333333-3333-4333-8333-333333333333',
  createdSiteId: '44444444-4444-4444-8444-444444444444',
} as const;

type ManagedSiteRow = {
  id: string;
  bid: string | null;
  name: string;
  url: string;
  sign: string;
  icon_base64: string | null;
  feed: NonNullable<SiteAuditSnapshot['feed']>;
  from: NonNullable<SiteAuditSnapshot['from']>;
  classification_status: 'COMPLETE' | 'NEEDS_REVIEW';
  sitemap: string | null;
  link_page: string | null;
  access_scope: 'BOTH' | 'CN_ONLY' | 'GLOBAL_ONLY';
  status: 'OK' | 'ERROR' | 'SSLERROR';
  is_show: boolean;
  recommend: boolean;
  reason: string | null;
  update_time: Date;
};

export const BASE_MANAGED_SITE_ROW: ManagedSiteRow = {
  id: MANAGEMENT_TEST_IDS.siteId,
  bid: 'example-bid',
  name: 'Example Blog',
  url: 'https://example.com',
  sign: 'A blog about software',
  icon_base64: null,
  feed: [],
  from: ['WEB_SUBMIT'],
  classification_status: 'COMPLETE',
  sitemap: null,
  link_page: null,
  access_scope: 'BOTH',
  status: 'OK',
  is_show: true,
  recommend: false,
  reason: null,
  update_time: new Date('2026-04-09T09:00:00.000Z'),
};

export const BASE_MANAGED_SITE_SNAPSHOT: SiteAuditSnapshot = {
  bid: BASE_MANAGED_SITE_ROW.bid,
  name: BASE_MANAGED_SITE_ROW.name,
  url: BASE_MANAGED_SITE_ROW.url,
  sign: BASE_MANAGED_SITE_ROW.sign,
  icon_base64: BASE_MANAGED_SITE_ROW.icon_base64,
  feed: BASE_MANAGED_SITE_ROW.feed,
  from: [...BASE_MANAGED_SITE_ROW.from],
  classification_status: BASE_MANAGED_SITE_ROW.classification_status,
  sitemap: BASE_MANAGED_SITE_ROW.sitemap,
  link_page: BASE_MANAGED_SITE_ROW.link_page,
  access_scope: BASE_MANAGED_SITE_ROW.access_scope,
  status: BASE_MANAGED_SITE_ROW.status,
  is_show: BASE_MANAGED_SITE_ROW.is_show,
  recommend: BASE_MANAGED_SITE_ROW.recommend,
  reason: BASE_MANAGED_SITE_ROW.reason,
  main_tag: null,
  sub_tags: null,
  architecture: null,
};

export function buildManagedSiteSnapshot(
  overrides: Partial<SiteAuditSnapshot> = {},
): SiteAuditSnapshot {
  return {
    ...BASE_MANAGED_SITE_SNAPSHOT,
    ...overrides,
  };
}

export function createManagedSiteSnapshotSteps(siteRow: Partial<ManagedSiteRow> = {}): QueryStep[] {
  return [
    {
      table: Sites,
      rows: [{ ...BASE_MANAGED_SITE_ROW, ...siteRow }],
    },
    {
      table: SiteTags,
      rows: [],
    },
    {
      table: SiteArchitectures,
      rows: [],
    },
  ];
}

export function mockManagementUser(
  app: ReturnType<typeof createTestApp>,
  permission: 'site.manage' | 'site_audit.review',
): void {
  app.auth.getCurrentUser = vi.fn(async () => ({
    id: MANAGEMENT_TEST_IDS.actorId,
    role: 'ADMIN',
    nickname: 'Alice',
    email: 'alice@example.com',
    permissions: [permission],
  })) as unknown as typeof app.auth.getCurrentUser;
}
