import { describe, expect, it } from 'vitest';

import {
  siteAuditInsertSchema,
  siteAuditSnapshotSchema,
  siteClaimStatusSchema,
  siteFeedbackAuditInsertSchema,
  siteFeedbackReasonSchema,
  siteInsertSchema,
  siteUpdateSchema,
  tagDefinitionInsertSchema,
  taskScheduleInsertSchema,
} from '../src/zod/index.ts';

const expectSuccess = (result: { success: boolean; error?: { issues: unknown } }) => {
  if (!result.success) {
    throw new Error(JSON.stringify(result.error?.issues));
  }
};

const expectFailurePath = (
  result: {
    success: boolean;
    error?: { issues: Array<{ path: PropertyKey[] }> };
  },
  expectedPath: string,
) => {
  expect(result.success).toBe(false);
  expect(result.error?.issues.some((issue) => issue.path.join('.') === expectedPath)).toBe(true);
};

describe('db zod site url validation', () => {
  it('accepts valid public site urls in site inserts', () => {
    const result = siteInsertSchema.safeParse({
      bid: 'example-blog',
      name: 'Example Blog',
      url: 'https://example.com',
      feed: [
        {
          name: 'Primary Feed',
          url: 'https://blog.example.co.uk/feed.xml',
          type: 'RSS',
          isDefault: true,
        },
      ],
      sitemap: 'https://example.com/sitemap.xml',
      link_page: 'https://links.example.com/friends',
    });

    expectSuccess(result);
  });

  it('rejects non-absolute site urls', () => {
    const result = siteInsertSchema.safeParse({
      bid: 'missing-scheme',
      name: 'Missing Scheme',
      url: 'example.com',
    });

    expectFailurePath(result, 'url');
  });

  it('rejects invalid hostname labels', () => {
    const result = siteInsertSchema.safeParse({
      bid: 'bad-hostname',
      name: 'Bad Hostname',
      url: 'https://foo_bar.com',
    });

    expectFailurePath(result, 'url');
  });

  it('still allows clearing nullable site urls on updates', () => {
    const result = siteUpdateSchema.safeParse({
      sitemap: null,
      link_page: null,
    });

    expectSuccess(result);
  });

  it('validates nested site snapshot urls', () => {
    const result = siteAuditInsertSchema.safeParse({
      action: 'CREATE',
      proposed_snapshot: {
        url: 'https://example.com',
        feed: [
          {
            name: 'Primary Feed',
            url: 'https://example.com/feed.xml',
            type: 'RSS',
            isDefault: true,
          },
        ],
        link_page: 'https://localhost/friends',
      },
    });

    expectFailurePath(result, 'proposed_snapshot.link_page');
  });

  it('validates payload_template.target.site_id', () => {
    const result = taskScheduleInsertSchema.safeParse({
      name: 'Feed Fetch Schedule',
      task_type: 'RSS_FETCH',
      schedule_mode: 'CRON',
      schedule_config: {
        cron: '0 0 * * *',
      },
      payload_template: {
        target: {
          kind: 'SITE',
          site_id: 'not-a-uuid',
        },
      },
    });

    expectFailurePath(result, 'payload_template.target.site_id');
  });

  it('accepts empty feed arrays', () => {
    const result = siteInsertSchema.safeParse({
      bid: 'example-blog',
      name: 'Example Blog',
      url: 'https://example.com',
      feed: [],
    });

    expectSuccess(result);
  });

  it('rejects feed without a default item', () => {
    const result = siteInsertSchema.safeParse({
      bid: 'example-blog',
      name: 'Example Blog',
      url: 'https://example.com',
      feed: [
        {
          name: 'Primary Feed',
          url: 'https://example.com/feed.xml',
          type: 'RSS',
          isDefault: false,
        },
      ],
    });

    expectFailurePath(result, 'feed');
  });

  it('rejects feed with multiple default items', () => {
    const result = siteInsertSchema.safeParse({
      bid: 'example-blog',
      name: 'Example Blog',
      url: 'https://example.com',
      feed: [
        {
          name: 'Primary Feed',
          url: 'https://example.com/feed.xml',
          type: 'RSS',
          isDefault: true,
        },
        {
          name: 'Atom Feed',
          url: 'https://example.com/atom.xml',
          type: 'ATOM',
          isDefault: true,
        },
      ],
    });

    expectFailurePath(result, 'feed');
  });

  it('accepts structured sub_tags with selected, custom, and mixed values', () => {
    expect(
      siteAuditSnapshotSchema.safeParse({
        main_tag: {
          tag_id: crypto.randomUUID(),
        },
        sub_tags: [
          {
            tag_id: crypto.randomUUID(),
          },
        ],
      }).success,
    ).toBe(true);

    expect(
      siteAuditSnapshotSchema.safeParse({
        sub_tags: [
          {
            tag_id: null,
            name: '前端',
            name_normalized: '前端',
          },
        ],
      }).success,
    ).toBe(true);

    expect(
      siteAuditSnapshotSchema.safeParse({
        sub_tags: [
          {
            tag_id: crypto.randomUUID(),
            name: '开发',
            name_normalized: '开发',
          },
          {
            tag_id: null,
            name: '前端',
            name_normalized: '前端',
          },
        ],
      }).success,
    ).toBe(true);
  });

  it('rejects invalid structured sub_tags entries', () => {
    expectFailurePath(
      siteAuditSnapshotSchema.safeParse({
        sub_tags: [
          {
            tag_id: null,
            name: null,
            name_normalized: null,
          },
        ],
      }),
      'sub_tags.0',
    );

    expectFailurePath(
      siteAuditSnapshotSchema.safeParse({
        sub_tags: [
          { tag_id: '11111111-1111-4111-8111-111111111111' },
          { tag_id: '11111111-1111-4111-8111-111111111111' },
        ],
      }),
      'sub_tags',
    );

    expectFailurePath(
      siteAuditSnapshotSchema.safeParse({
        sub_tags: [
          { tag_id: null, name: 'Node.js', name_normalized: 'nodejs' },
          { tag_id: null, name: 'Node JS', name_normalized: 'nodejs' },
        ],
      }),
      'sub_tags',
    );
  });

  it('accepts new claim statuses and rejects legacy status', () => {
    expect(siteClaimStatusSchema.safeParse('PENDING_VERIFICATION').success).toBe(true);
    expect(siteClaimStatusSchema.safeParse('PENDING_REVIEW').success).toBe(true);
    expect(siteClaimStatusSchema.safeParse('PENDING').success).toBe(false);
  });

  it('requires machine_key for warning tag definitions', () => {
    expect(
      tagDefinitionInsertSchema.safeParse({
        name: '外部限制',
        tag_type: 'WARNING',
        is_enabled: true,
      }).success,
    ).toBe(false);

    expect(
      tagDefinitionInsertSchema.safeParse({
        name: '外部限制',
        tag_type: 'WARNING',
        machine_key: 'EXTERNAL_LIMIT',
        is_enabled: true,
      }).success,
    ).toBe(true);
  });

  it('accepts site feedback reasons and validates site feedback payloads', () => {
    expect(siteFeedbackReasonSchema.safeParse('SITE_INFO_ERROR').success).toBe(true);
    expect(siteFeedbackReasonSchema.safeParse('NOT_EXISTS').success).toBe(false);

    expect(
      siteFeedbackAuditInsertSchema.safeParse({
        site_id: crypto.randomUUID(),
        reason_type: 'ACCESS_ISSUE',
        feedback_content: '站点已经连续多日无法访问。',
        reporter_name: 'Alice',
        reporter_email: 'alice@example.com',
        notify_by_email: true,
      }).success,
    ).toBe(true);
  });
});
