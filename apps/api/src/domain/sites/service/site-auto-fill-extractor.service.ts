import type { FeedTypeKey, MultiFeed } from '@zhblogs/db';

import type { SiteAutoFillHints } from '../types/site-auto-fill.types';

const META_PATTERN =
  /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']*)["'][^>]*>/gi;
const TITLE_PATTERN = /<title[^>]*>([^<]*)<\/title>/i;
const ANCHOR_PATTERN = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const LINK_TAG_PATTERN = /<link\b[^>]*>/gi;
const HREF_ATTR_PATTERN = /href=["']([^"']+)["']/i;
const REL_ATTR_PATTERN = /rel=["']([^"']+)["']/i;
const TYPE_ATTR_PATTERN = /type=["']([^"']+)["']/i;

const FEED_TYPE_BY_MIME: Record<string, FeedTypeKey> = {
  'application/rss+xml': 'RSS',
  'application/atom+xml': 'ATOM',
  'application/feed+json': 'JSON',
  'application/json': 'JSON',
};

const DEFAULT_FEED_PATHS = ['/feed', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml'];

const DEFAULT_LINK_PAGE_PATHS = ['/friends', '/links', '/friend-links'];

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const decodeHtml = (value: string): string =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");

const absolutizeUrl = (value: string, baseUrl: string): string => {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return '';
  }
};

const dedupeUrls = <T extends { url: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) {
      return false;
    }

    seen.add(item.url);
    return true;
  });
};

export const dedupeStrings = (items: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of items) {
    const value = item.trim();

    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
};

const dedupePaths = (paths: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const path of paths) {
    const value = path.trim();

    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
};

export const mergePaths = (provided: string[] | undefined, defaults: string[]): string[] =>
  dedupePaths([...(provided ?? []), ...defaults]);

export function pickDescription(html: string): string {
  const descriptions: string[] = [];

  for (const match of html.matchAll(META_PATTERN)) {
    const key = match[1]?.toLowerCase();
    const value = normalizeWhitespace(decodeHtml(match[2] ?? ''));

    if (!value) {
      continue;
    }

    if (key === 'description' || key === 'og:description' || key === 'twitter:description') {
      descriptions.push(value);
    }
  }

  return descriptions[0] ?? '';
}

export function pickTitle(html: string): string {
  const title = html.match(TITLE_PATTERN)?.[1] ?? '';
  return normalizeWhitespace(decodeHtml(title));
}

export function pickDescriptionFromTitle(title: string): string {
  const segments = title
    .split(/\s+-\s+/)
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);

  return segments.length > 1 ? (segments.at(-1) ?? '') : '';
}

export function pageLooksLikeLinkPage(html: string): boolean {
  if (!html) {
    return false;
  }

  const keywordPattern = /(友情链接|友链|友情链接页面|friend\s*links?|blogroll|links?)/i;
  const title = pickTitle(html);

  if (keywordPattern.test(title)) {
    return true;
  }

  for (const match of html.matchAll(ANCHOR_PATTERN)) {
    const text = normalizeWhitespace(decodeHtml(match[2] ?? ''));

    if (keywordPattern.test(text)) {
      return true;
    }
  }

  return keywordPattern.test(html);
}

export function collectFeedCandidates(
  html: string,
  siteUrl: string,
  hints: SiteAutoFillHints = {},
): MultiFeed[] {
  const feeds: MultiFeed[] = [];

  for (const match of html.matchAll(LINK_TAG_PATTERN)) {
    const tag = match[0] ?? '';
    const rel = tag.match(REL_ATTR_PATTERN)?.[1] ?? '';

    if (!/(?:alternate|service\.feed)/i.test(rel)) {
      continue;
    }

    const href = absolutizeUrl(tag.match(HREF_ATTR_PATTERN)?.[1] ?? '', siteUrl);
    if (!href) {
      continue;
    }

    const type =
      FEED_TYPE_BY_MIME[(tag.match(TYPE_ATTR_PATTERN)?.[1] ?? '').toLowerCase()] ?? 'RSS';
    feeds.push({
      name: feeds.length === 0 ? '默认订阅' : `订阅 ${feeds.length + 1}`,
      url: href,
      type,
      isDefault: feeds.length === 0,
    });
  }

  const keywordPattern = /(rss|atom|feed|订阅)/i;

  for (const match of html.matchAll(ANCHOR_PATTERN)) {
    const href = absolutizeUrl(match[1] ?? '', siteUrl);
    const text = normalizeWhitespace(decodeHtml(match[2] ?? ''));

    if (!href || !keywordPattern.test(`${href} ${text}`)) {
      continue;
    }

    feeds.push({
      name: feeds.length === 0 ? '默认订阅' : `订阅 ${feeds.length + 1}`,
      url: href,
      type: /atom/i.test(`${href} ${text}`) ? 'ATOM' : 'RSS',
      isDefault: feeds.length === 0,
    });
  }

  const hintFeeds: MultiFeed[] = mergePaths(hints.feed_paths, DEFAULT_FEED_PATHS).map(
    (path, index): MultiFeed => ({
      name: index === 0 ? '默认订阅' : `订阅 ${index + 1}`,
      url: absolutizeUrl(path, siteUrl),
      type: /atom/i.test(path) ? 'ATOM' : 'RSS',
      isDefault: index === 0,
    }),
  );

  return dedupeUrls([...feeds, ...hintFeeds])
    .slice(0, 8)
    .map((feed, index): MultiFeed => {
      const renamed: MultiFeed = {
        name: index === 0 ? '默认订阅' : `订阅 ${index + 1}`,
        url: feed.url,
        isDefault: index === 0,
      };

      if (feed.type) {
        renamed.type = feed.type;
      }

      return renamed;
    });
}

export function collectLinkPageCandidates(
  html: string,
  siteUrl: string,
  hints: SiteAutoFillHints = {},
): string[] {
  const keywordPattern = /(友情链接|友链|links?|blogroll)/i;
  const candidates: string[] = [];

  for (const match of html.matchAll(ANCHOR_PATTERN)) {
    const href = absolutizeUrl(match[1] ?? '', siteUrl);
    const text = normalizeWhitespace(decodeHtml(match[2] ?? ''));

    if (href && keywordPattern.test(`${href} ${text}`)) {
      candidates.push(href);
    }
  }

  for (const path of mergePaths(hints.link_page_paths, DEFAULT_LINK_PAGE_PATHS)) {
    candidates.push(absolutizeUrl(path, siteUrl));
  }

  return dedupeStrings(candidates);
}

export function collectSitemapCandidatesFromHtml(html: string, siteUrl: string): string[] {
  const keywordPattern = /(网站地图|站点地图|sitemap)/i;
  const candidates: string[] = [];

  for (const match of html.matchAll(LINK_TAG_PATTERN)) {
    const tag = match[0] ?? '';
    const href = absolutizeUrl(tag.match(HREF_ATTR_PATTERN)?.[1] ?? '', siteUrl);

    if (!href || !keywordPattern.test(tag)) {
      continue;
    }

    candidates.push(href);
  }

  for (const match of html.matchAll(ANCHOR_PATTERN)) {
    const href = absolutizeUrl(match[1] ?? '', siteUrl);
    const text = normalizeWhitespace(decodeHtml(match[2] ?? ''));

    if (href && keywordPattern.test(`${href} ${text}`)) {
      candidates.push(href);
    }
  }

  return dedupeStrings(candidates);
}
