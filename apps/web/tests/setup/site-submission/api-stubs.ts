import { createJsonResponse } from '../mocks';

const DEFAULT_RESOLVED_SITE = {
  site_id: '11111111-1111-4111-8111-111111111111',
  bid: 'example-blog',
  name: 'Example Blog',
  url: 'https://example.com',
  sign: 'Old sign',
  feed: [],
  sitemap: null,
  link_page: null,
  main_tag_id: null,
  sub_tags: [],
  architecture: null,
} as const;

const createSubmissionResult = (
  auditId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  siteId: string | null,
): Response =>
  createJsonResponse(
    {
      ok: true,
      data: {
        audit_id: auditId,
        action,
        status: 'PENDING',
        site_id: siteId,
      },
    },
    201,
  );

export const siteSubmissionApiStubs = {
  resolvedSite: (overrides: Partial<typeof DEFAULT_RESOLVED_SITE> = {}): Response =>
    createJsonResponse(
      {
        ok: true,
        data: {
          ...DEFAULT_RESOLVED_SITE,
          ...overrides,
        },
      },
      200,
    ),
  created: (auditId = '11111111-1111-4111-8111-111111111111'): Response =>
    createSubmissionResult(auditId, 'CREATE', null),
  updated: (
    auditId = '22222222-2222-4222-8222-222222222222',
    siteId = DEFAULT_RESOLVED_SITE.site_id,
  ): Response => createSubmissionResult(auditId, 'UPDATE', siteId),
  deleted: (
    auditId = '33333333-3333-4333-8333-333333333333',
    siteId = DEFAULT_RESOLVED_SITE.site_id,
  ): Response => createSubmissionResult(auditId, 'DELETE', siteId),
  emptyOptions: (): Response =>
    createJsonResponse(
      {
        ok: true,
        data: {
          main_tags: [],
          sub_tags: [],
          programs: [],
          tech_stacks: [],
        },
      },
      200,
    ),
  queryResult: (): Response =>
    createJsonResponse(
      {
        ok: true,
        data: {
          audit_id: '22222222-2222-4222-8222-222222222222',
          action: 'UPDATE',
          status: 'APPROVED',
          site_id: DEFAULT_RESOLVED_SITE.site_id,
          site_name: DEFAULT_RESOLVED_SITE.name,
          reviewer_comment: 'Looks good.',
          created_time: '2026-03-18T08:00:00.000Z',
          reviewed_time: '2026-03-19T09:30:00.000Z',
        },
      },
      200,
    ),
  searchResults: (): Response =>
    createJsonResponse(
      {
        ok: true,
        data: [
          {
            site_id: DEFAULT_RESOLVED_SITE.site_id,
            bid: DEFAULT_RESOLVED_SITE.bid,
            name: DEFAULT_RESOLVED_SITE.name,
            url: DEFAULT_RESOLVED_SITE.url,
          },
        ],
      },
      200,
    ),
  autoFilled: (): Response =>
    createJsonResponse(
      {
        ok: true,
        data: {
          name: DEFAULT_RESOLVED_SITE.name,
          sign: 'A blog about software',
          feed_candidates: [
            {
              name: '默认订阅',
              url: 'https://example.com/feed.xml',
            },
          ],
          sitemap: 'https://example.com/sitemap.xml',
          link_page: 'https://example.com/friends',
          architecture: null,
        },
      },
      200,
    ),
};
