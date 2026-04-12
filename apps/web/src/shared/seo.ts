export const ZHBLOGS_SITE_NAME = '集博栈 - zhblogs';
export const ZHBLOGS_SITE_URL = 'https://www.zhblogs.net';
export const DEFAULT_SEO_DESCRIPTION = '该博客未留下描述信息呢，不如亲自访问看看？';
export const DEFAULT_SEO_IMAGE_PATH = '/og-default.svg';

export interface SeoMetadataInput {
  pathname: string;
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogType?: 'website' | 'article';
  imagePath?: string;
  imageAlt?: string;
  robots?: string;
  publishedTime?: string | Date;
  modifiedTime?: string | Date;
}

export interface SeoMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType: 'website' | 'article';
  imageUrl: string;
  imageAlt: string;
  robots: string;
  publishedTime?: string;
  modifiedTime?: string;
}

function normalizePath(value: string): string {
  if (!value) {
    return '/';
  }

  if (!value.startsWith('/')) {
    return `/${value}`;
  }

  return value;
}

function toIsoString(value: string | Date | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const target = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(target.getTime())) {
    return undefined;
  }

  return target.toISOString();
}

export function buildAbsoluteSiteUrl(pathname: string): string {
  return new URL(normalizePath(pathname), ZHBLOGS_SITE_URL).toString();
}

export function shouldNoIndexPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/forbidden' ||
    pathname === '/site/go' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/management') ||
    pathname.startsWith('/site/submit')
  );
}

export function resolveDefaultRobots(pathname: string): string {
  return shouldNoIndexPath(pathname) ? 'noindex, nofollow' : 'index, follow';
}

export function resolveSeoMetadata(input: SeoMetadataInput): SeoMetadata {
  const canonicalPath = normalizePath(input.canonicalPath ?? input.pathname);

  return {
    title: input.title?.trim() || ZHBLOGS_SITE_NAME,
    description: input.description?.trim() || DEFAULT_SEO_DESCRIPTION,
    canonicalUrl: buildAbsoluteSiteUrl(canonicalPath),
    ogType: input.ogType ?? 'website',
    imageUrl: buildAbsoluteSiteUrl(input.imagePath ?? DEFAULT_SEO_IMAGE_PATH),
    imageAlt: input.imageAlt?.trim() || `${ZHBLOGS_SITE_NAME} 默认分享卡片`,
    robots: input.robots?.trim() || resolveDefaultRobots(input.pathname),
    publishedTime: toIsoString(input.publishedTime),
    modifiedTime: toIsoString(input.modifiedTime),
  };
}
