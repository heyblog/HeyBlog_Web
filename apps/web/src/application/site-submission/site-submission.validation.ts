const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function trimText(value: string): string {
  return value.trim();
}

export function normalizeEmail(value: string): string {
  return trimText(value).toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(trimText(value));
}

export function isHttpUrl(value: string): boolean {
  try {
    const target = new URL(trimText(value));
    return target.protocol === 'http:' || target.protocol === 'https:';
  } catch {
    return false;
  }
}

export function createComparableHttpUrlKey(value: string | null | undefined): string | null {
  const normalized = trimText(value ?? '');

  if (!normalized) {
    return null;
  }

  try {
    const target = new URL(normalized);

    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return null;
    }

    target.hostname = target.hostname.toLowerCase();
    target.hash = '';

    if (
      (target.protocol === 'http:' && target.port === '80') ||
      (target.protocol === 'https:' && target.port === '443')
    ) {
      target.port = '';
    }

    if (target.pathname !== '/') {
      target.pathname = target.pathname.replace(/\/+$/u, '') || '/';
    }

    return target.toString();
  } catch {
    return null;
  }
}

export function patchByUrl(currentUrl: string, fallbackPath: string): string {
  const normalized = trimText(currentUrl);

  if (!isHttpUrl(normalized)) {
    return '';
  }

  try {
    const url = new URL(normalized);
    url.pathname = fallbackPath;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function guessDefaultFeedUrl(siteUrl: string): string {
  return patchByUrl(siteUrl, '/feed');
}

export function guessDefaultSitemapUrl(siteUrl: string): string {
  return patchByUrl(siteUrl, '/sitemap.xml');
}

export function guessDefaultLinkPageUrl(siteUrl: string): string {
  return patchByUrl(siteUrl, '/friends');
}
