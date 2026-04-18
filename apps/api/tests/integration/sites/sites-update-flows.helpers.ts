import {
  ProgramTechnologyStacks,
  SiteArchitectures,
  SiteAudits,
  Sites,
  SiteTags,
  TechnologyCatalogs,
} from '@zhblogs/db';

import { type createTestApp } from '@tests/create-test-app';
import { mockReadSelect } from '@tests/fixtures/db-mocks';

export const updateFlowSiteId = '11111111-1111-4111-8111-111111111111';
export const updateFlowFrameworkId = '44444444-4444-4444-8444-444444444444';

const buildUpdateFlowSiteRow = (overrides: Record<string, unknown> = {}) => ({
  id: updateFlowSiteId,
  bid: 'example-blog',
  name: 'Example Blog',
  url: 'https://example.com',
  sign: 'Old sign',
  icon_base64: null,
  feed: [],
  from: ['WEB_SUBMIT'],
  classification_status: 'COMPLETE',
  sitemap: 'https://example.com/sitemap.xml',
  link_page: 'https://example.com/friends',
  access_scope: 'ALL',
  status: 'OK',
  is_show: true,
  recommend: false,
  reason: null,
  ...overrides,
});

const buildCatalogRows = () => [
  {
    table: TechnologyCatalogs,
    rows: [
      {
        id: updateFlowFrameworkId,
        name: 'Astro',
        name_normalized: 'astro',
        technology_type: 'FRAMEWORK',
      },
    ],
  },
  {
    table: TechnologyCatalogs,
    rows: [
      {
        id: updateFlowFrameworkId,
        name: 'Astro',
        name_normalized: 'astro',
        technology_type: 'FRAMEWORK',
      },
    ],
  },
];

export function mockSiteUpdateFlowReads(
  app: ReturnType<typeof createTestApp>,
  options: {
    siteOverrides?: Record<string, unknown>;
    includeCatalogs?: boolean;
    pendingAuditRows?: unknown[];
    activeAuditRows?: unknown[];
    finalSiteRows?: unknown[];
  } = {},
) {
  const rows: Array<{ table: unknown; rows: unknown[] }> = [
    {
      table: Sites,
      rows: [buildUpdateFlowSiteRow(options.siteOverrides)],
    },
    {
      table: SiteTags,
      rows: [],
    },
    {
      table: SiteArchitectures,
      rows: [],
    },
    {
      table: ProgramTechnologyStacks,
      rows: [],
    },
    {
      table: SiteAudits,
      rows: options.pendingAuditRows ?? [],
    },
  ];

  if (options.activeAuditRows) {
    rows.push({
      table: SiteAudits,
      rows: options.activeAuditRows,
    });
  } else {
    if (options.includeCatalogs) {
      rows.push(...buildCatalogRows());
    }

    rows.push({
      table: Sites,
      rows: options.finalSiteRows ?? [],
    });
  }

  mockReadSelect(app, rows);
}
