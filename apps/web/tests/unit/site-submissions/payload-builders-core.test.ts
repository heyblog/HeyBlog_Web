import { describe, expect, it } from 'vitest';

import {
  buildCreateSubmissionPayload,
  buildDeleteSubmissionPayload,
  buildUpdateSubmissionPayload,
  createInitialCreateForm,
  createInitialDeleteForm,
  createUpdateFormFromResolvedSite,
} from '@/application/site-submission/site-submission.service';
describe('site submission payload builders', () => {
  it('builds a create payload with normalized contact info and default feed ordering', () => {
    const form = createInitialCreateForm();
    const secondaryFeedId = form.feeds[0]?.id ?? '';

    form.submitter_name = ' Alice ';
    form.submitter_email = ' Alice@Example.com ';
    form.notify_by_email = false;
    form.agree_terms = true;
    form.name = 'Example Blog';
    form.url = 'https://example.com';
    form.sign = ' A blog about software ';
    form.main_tag_id = 'main-tag-id';
    form.sub_tags = [
      { tag_id: null, name: '前端', name_normalized: '前端' },
      { tag_id: null, name: ' 架构 ', name_normalized: '架构' },
      { tag_id: null, name: '前端', name_normalized: '前端' },
    ];
    form.feeds = [
      {
        id: 'feed-primary',
        name: '站点主订阅',
        url: 'https://example.com/feed.xml',
        type: 'RSS',
        isDefault: false,
      },
      {
        id: secondaryFeedId,
        name: '站点更新',
        url: 'https://example.com/atom.xml',
        type: 'ATOM',
        isDefault: true,
      },
    ];
    form.sitemap = 'https://example.com/sitemap.xml';
    form.link_page = 'https://example.com/friends';
    form.architecture_program_name = ' Astro ';

    const result = buildCreateSubmissionPayload(form);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data).toEqual({
      submitter_name: 'Alice',
      submitter_email: 'alice@example.com',
      submit_reason: '',
      notify_by_email: false,
      site: {
        name: 'Example Blog',
        url: 'https://example.com',
        sign: 'A blog about software',
        feed: [
          {
            name: '站点主订阅',
            url: 'https://example.com/feed.xml',
            type: 'RSS',
            isDefault: false,
          },
          {
            name: '站点更新',
            url: 'https://example.com/atom.xml',
            type: 'ATOM',
            isDefault: true,
          },
        ],
        sitemap: 'https://example.com/sitemap.xml',
        link_page: 'https://example.com/friends',
        main_tag_id: 'main-tag-id',
        sub_tags: [
          {
            tag_id: null,
            name: '架构',
            name_normalized: '架构',
          },
          {
            tag_id: null,
            name: '前端',
            name_normalized: '前端',
          },
        ],
        architecture: {
          program_id: null,
          program_name: 'Astro',
          program_is_open_source: null,
          stacks: null,
          website_url: null,
          repo_url: null,
        },
      },
    });
  });

  it('maps blank contact info to null for create payloads', () => {
    const form = createInitialCreateForm();

    form.submitter_name = '   ';
    form.submitter_email = '   ';
    form.notify_by_email = false;
    form.agree_terms = true;
    form.name = 'Example Blog';
    form.url = 'https://example.com';
    form.sign = 'A blog about software';
    form.main_tag_id = 'main-tag-id';

    const result = buildCreateSubmissionPayload(form);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.submitter_name).toBeNull();
    expect(result.data.submitter_email).toBeNull();
  });

  it('keeps architecture links when recording program', () => {
    const form = createInitialCreateForm();

    form.submitter_name = 'Alice';
    form.submitter_email = 'alice@example.com';
    form.notify_by_email = false;
    form.agree_terms = true;
    form.name = 'Example Blog';
    form.url = 'https://example.com';
    form.sign = 'A blog about software';
    form.main_tag_id = 'main-tag-id';
    form.architecture_program_name = 'Ghost';
    form.architecture_website_url = '';
    form.architecture_repo_url = 'https://github.com/ghost/ghost';

    const result = buildCreateSubmissionPayload(form);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.site.architecture).toMatchObject({
      website_url: 'https://github.com/ghost/ghost',
      repo_url: 'https://github.com/ghost/ghost',
    });
  });

  it('includes architecture stacks from selected and custom tech fields', () => {
    const form = createInitialCreateForm();

    form.submitter_name = 'Alice';
    form.submitter_email = 'alice@example.com';
    form.notify_by_email = false;
    form.agree_terms = true;
    form.name = 'Example Blog';
    form.url = 'https://example.com';
    form.sign = 'A blog about software';
    form.main_tag_id = 'main-tag-id';
    form.architecture_program_name = 'Astro';
    form.architecture_framework_ids = ['framework-1', 'framework-1', 'framework-2'];
    form.architecture_framework_custom_names = ['UnoCSS', ' unocss '];
    form.architecture_language_ids = ['language-1'];
    form.architecture_language_custom_names = ['TypeScript', 'typescript'];

    const result = buildCreateSubmissionPayload(form);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.site.architecture?.stacks).toEqual([
      {
        category: 'FRAMEWORK',
        catalog_id: 'framework-1',
        name: null,
        name_normalized: null,
      },
      {
        category: 'FRAMEWORK',
        catalog_id: 'framework-2',
        name: null,
        name_normalized: null,
      },
      {
        category: 'FRAMEWORK',
        catalog_id: null,
        name: 'UnoCSS',
        name_normalized: 'unocss',
      },
      {
        category: 'LANGUAGE',
        catalog_id: 'language-1',
        name: null,
        name_normalized: null,
      },
      {
        category: 'LANGUAGE',
        catalog_id: null,
        name: 'TypeScript',
        name_normalized: 'typescript',
      },
    ]);
  });

  it('keeps program and technology stacks independent even when names overlap', () => {
    const form = createInitialCreateForm();

    form.submitter_name = 'Alice';
    form.submitter_email = 'alice@example.com';
    form.notify_by_email = false;
    form.agree_terms = true;
    form.name = 'Example Blog';
    form.url = 'https://example.com';
    form.sign = 'A blog about software';
    form.main_tag_id = 'main-tag-id';
    form.architecture_program_name = 'Astro';
    form.architecture_framework_custom_names = ['Astro'];
    form.architecture_language_custom_names = ['Node.js'];

    const result = buildCreateSubmissionPayload(form);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.site.architecture).toEqual({
      program_id: null,
      program_name: 'Astro',
      program_is_open_source: null,
      stacks: [
        {
          category: 'FRAMEWORK',
          catalog_id: null,
          name: 'Astro',
          name_normalized: 'astro',
        },
        {
          category: 'LANGUAGE',
          catalog_id: null,
          name: 'Node.js',
          name_normalized: 'nodejs',
        },
      ],
      website_url: null,
      repo_url: null,
    });
  });

  it('requires at least one changed field for an update submission', () => {
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
      sub_tags: [
        {
          tag_id: 'sub-tag-id',
          name: '开发',
          name_normalized: '开发',
        },
        {
          tag_id: null,
          name: '前端',
          name_normalized: '前端',
        },
      ],
      architecture: {
        program_id: null,
        program_name: 'Astro',
        program_is_open_source: null,
        stacks: null,
        website_url: null,
        repo_url: null,
      },
    };
    const form = createUpdateFormFromResolvedSite(current);

    form.submitter_name = 'Alice';
    form.submitter_email = 'alice@example.com';
    form.submit_reason = 'Refresh profile';
    form.agree_terms = true;

    const result = buildUpdateSubmissionPayload(form, current);

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.formError).toBe('至少修改一个字段后才能提交修订。');
    expect(result.fieldErrors).toMatchObject({
      changes: '至少修改一个字段后才能提交修订。',
    });
  });

  it('detects architecture stack changes for update payload', () => {
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
      sub_tags: [
        {
          tag_id: 'sub-tag-id',
          name: '开发',
          name_normalized: '开发',
        },
        {
          tag_id: null,
          name: '前端',
          name_normalized: '前端',
        },
      ],
      architecture: {
        program_id: null,
        program_name: 'Astro',
        program_is_open_source: null,
        stacks: null,
        website_url: null,
        repo_url: null,
      },
    };
    const form = createUpdateFormFromResolvedSite(current);

    form.submitter_name = 'Alice';
    form.submitter_email = 'alice@example.com';
    form.agree_terms = true;
    form.architecture_framework_ids = ['framework-1'];

    const result = buildUpdateSubmissionPayload(form, current);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.changes.architecture).toMatchObject({
      program_name: 'Astro',
      stacks: [
        {
          category: 'FRAMEWORK',
          catalog_id: 'framework-1',
          name: null,
          name_normalized: null,
        },
      ],
    });
  });

  it('preserves feed types when building update payloads from resolved sites', () => {
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
          type: 'ATOM' as const,
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
    form.submit_reason = '调整订阅信息';
    form.agree_terms = true;

    expect(form.feeds[0]?.type).toBe('ATOM');

    form.feeds[0] = {
      ...form.feeds[0],
      type: 'JSON',
    };

    const result = buildUpdateSubmissionPayload(form, current);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.changes.feed).toEqual([
      {
        name: '默认订阅',
        url: 'https://example.com/feed.xml',
        type: 'JSON',
        isDefault: true,
      },
    ]);
  });

  it('does not inject placeholder feed drafts when resolved site has no valid feed url', () => {
    const current = {
      site_id: '11111111-1111-4111-8111-111111111111',
      bid: 'example-blog',
      name: 'Example Blog',
      url: 'https://example.com',
      sign: 'A blog about software',
      feed: [
        {
          name: '默认订阅',
          url: '   ',
          type: 'RSS' as const,
          isDefault: true,
        },
      ],
      sitemap: null,
      link_page: null,
      main_tag_id: 'main-tag-id',
      sub_tags: [],
      architecture: null,
    };

    const form = createUpdateFormFromResolvedSite(current);

    expect(form.feeds).toEqual([]);
  });

  it('builds a delete payload with normalized contact info', () => {
    const form = createInitialDeleteForm();

    form.site_identifier = ' example-blog ';
    form.submitter_name = ' Alice ';
    form.submitter_email = ' Alice@Example.com ';
    form.submit_reason = ' 站点已停更 ';
    form.notify_by_email = true;
    form.agree_terms = true;

    const result = buildDeleteSubmissionPayload(form);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data).toEqual({
      site_identifier: 'example-blog',
      submitter_name: 'Alice',
      submitter_email: 'alice@example.com',
      submit_reason: '站点已停更',
      notify_by_email: true,
    });
  });

  it('maps blank contact info to null for delete payloads', () => {
    const form = createInitialDeleteForm();

    form.site_identifier = 'example-blog';
    form.submitter_name = ' ';
    form.submitter_email = ' ';
    form.submit_reason = '站点已停更';
    form.notify_by_email = false;
    form.agree_terms = true;

    const result = buildDeleteSubmissionPayload(form);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.submitter_name).toBeNull();
    expect(result.data.submitter_email).toBeNull();
  });
});
