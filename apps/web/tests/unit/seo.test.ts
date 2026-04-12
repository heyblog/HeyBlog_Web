import { describe, expect, it } from 'vitest';

import { buildAbsoluteSiteUrl, resolveSeoMetadata, shouldNoIndexPath } from '@/shared/seo';

describe('seo helpers', () => {
  it('builds canonical urls from the fixed site origin', () => {
    expect(buildAbsoluteSiteUrl('/site')).toBe('https://www.zhblogs.net/site');
    expect(buildAbsoluteSiteUrl('blog')).toBe('https://www.zhblogs.net/blog');
  });

  it('marks utility and management pages as noindex', () => {
    expect(shouldNoIndexPath('/site/go')).toBe(true);
    expect(shouldNoIndexPath('/site/submit/update')).toBe(true);
    expect(shouldNoIndexPath('/management/site-submissions')).toBe(true);
    expect(shouldNoIndexPath('/dashboard')).toBe(true);
    expect(shouldNoIndexPath('/site')).toBe(false);
  });

  it('uses page overrides when resolving metadata', () => {
    const metadata = resolveSeoMetadata({
      pathname: '/site/example',
      title: '示例站点 | 集博栈 - zhblogs',
      description: '站点简介',
      canonicalPath: '/site/example',
      ogType: 'article',
      imagePath: '/og/site/example.svg',
      publishedTime: '2026-03-01T08:00:00+08:00',
      modifiedTime: '2026-03-02T08:00:00+08:00',
    });

    expect(metadata).toMatchObject({
      title: '示例站点 | 集博栈 - zhblogs',
      description: '站点简介',
      canonicalUrl: 'https://www.zhblogs.net/site/example',
      ogType: 'article',
      robots: 'index, follow',
      imageUrl: 'https://www.zhblogs.net/og/site/example.svg',
    });
    expect(metadata.publishedTime).toBe('2026-03-01T00:00:00.000Z');
    expect(metadata.modifiedTime).toBe('2026-03-02T00:00:00.000Z');
  });
});
