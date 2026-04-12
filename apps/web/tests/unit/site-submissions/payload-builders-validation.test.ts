import { describe, expect, it } from 'vitest';

import {
  buildCreateSubmissionPayload,
  buildSubmissionQueryPayload,
  buildUpdateSubmissionPayload,
  createInitialCreateForm,
  createInitialQueryForm,
  createUpdateFormFromResolvedSite,
  getLookupPayload,
} from '@/application/site-submission/site-submission.service';
describe('site submission payload builders', () => {
  it('rejects create payload when inferred urls remain unchanged from site url', () => {
    const form = createInitialCreateForm();

    form.submitter_name = 'Alice';
    form.submitter_email = 'alice@example.com';
    form.notify_by_email = true;
    form.agree_terms = true;
    form.name = 'Example Blog';
    form.url = 'https://example.com';
    form.sign = 'A blog about software';
    form.main_tag_id = 'main-tag-id';
    form.feeds = [
      {
        id: 'feed-1',
        name: '默认订阅',
        url: 'https://example.com',
        type: 'RSS',
        isDefault: true,
      },
    ];
    form.sitemap = 'https://example.com';
    form.link_page = 'https://example.com';

    const result = buildCreateSubmissionPayload(form);

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.fieldErrors).toMatchObject({
      feeds: '订阅地址与站点地址相同，请补充具体路径或删除该订阅。',
      sitemap: '网站地图地址与站点地址相同，请补充具体路径或清空该字段。',
      link_page: '友链页面地址与站点地址相同，请补充具体路径或清空该字段。',
    });
  });

  it('rejects create payload when feed urls are equivalent after normalization', () => {
    const form = createInitialCreateForm();

    form.submitter_name = 'Alice';
    form.submitter_email = 'alice@example.com';
    form.notify_by_email = true;
    form.agree_terms = true;
    form.name = 'Example Blog';
    form.url = 'https://example.com';
    form.sign = 'A blog about software';
    form.main_tag_id = 'main-tag-id';
    form.feeds = [
      {
        id: 'feed-1',
        name: '主订阅',
        url: 'https://Example.com/feed.xml',
        type: 'RSS',
        isDefault: true,
      },
      {
        id: 'feed-2',
        name: '备用订阅',
        url: 'https://example.com/feed.xml/',
        type: 'ATOM',
        isDefault: false,
      },
    ];

    const result = buildCreateSubmissionPayload(form);

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.fieldErrors).toMatchObject({
      feeds: '订阅地址不能重复。',
    });
  });

  it('rejects update payload when inferred urls remain unchanged from site url', () => {
    const current = {
      site_id: '11111111-1111-4111-8111-111111111111',
      bid: 'example-blog',
      name: 'Example Blog',
      url: 'https://example.com',
      sign: 'A blog about software',
      feed: [
        {
          name: '默认订阅',
          url: 'https://example.com/feed.xml',
          type: 'RSS' as const,
          isDefault: true,
        },
      ],
      sitemap: 'https://example.com/sitemap.xml',
      link_page: 'https://example.com/friends',
      main_tag_id: 'main-tag-id',
      sub_tags: [],
      architecture: null,
    };
    const form = createUpdateFormFromResolvedSite(current);

    form.submitter_name = 'Alice';
    form.submitter_email = 'alice@example.com';
    form.submit_reason = '需要更新信息';
    form.agree_terms = true;
    form.feeds = [
      {
        id: 'feed-1',
        name: '默认订阅',
        url: 'https://example.com',
        type: 'RSS',
        isDefault: true,
      },
    ];
    form.sitemap = 'https://example.com';
    form.link_page = 'https://example.com';

    const result = buildUpdateSubmissionPayload(form, current);

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.fieldErrors).toMatchObject({
      feeds: '订阅地址与站点地址相同，请补充具体路径或删除该订阅。',
      sitemap: '网站地图地址与站点地址相同，请补充具体路径或清空该字段。',
      link_page: '友链页面地址与站点地址相同，请补充具体路径或清空该字段。',
    });
  });

  it('rejects create payloads when multiple feeds do not have a unique default item', () => {
    const form = createInitialCreateForm();

    form.agree_terms = true;
    form.name = 'Example Blog';
    form.url = 'https://example.com';
    form.sign = 'A blog about software';
    form.main_tag_id = 'main-tag-id';
    form.feeds = [
      {
        id: 'feed-1',
        name: '主订阅',
        url: 'https://example.com/feed.xml',
        type: 'RSS',
        isDefault: false,
      },
      {
        id: 'feed-2',
        name: '备用订阅',
        url: 'https://example.com/atom.xml',
        type: 'ATOM',
        isDefault: false,
      },
    ];

    const result = buildCreateSubmissionPayload(form);

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.fieldErrors).toMatchObject({
      feeds: '请确保恰好选择一个默认订阅地址。',
    });
  });

  it('rejects malformed query payloads', () => {
    const form = createInitialQueryForm();
    form.audit_id = 'bad-id';

    const result = buildSubmissionQueryPayload(form);

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.fieldErrors).toMatchObject({
      audit_id: expect.any(String),
    });
  });

  it('treats uuid v7 identifiers as site ids for lookup and query', () => {
    const v7Id = '0195b4f6-4d4a-7e54-9c42-7f2e9ab9d123';

    expect(getLookupPayload(v7Id)).toEqual({
      site_id: v7Id,
    });

    const form = createInitialQueryForm({
      audit_id: v7Id,
    });
    const result = buildSubmissionQueryPayload(form);

    expect(result.ok).toBe(true);
  });
});
