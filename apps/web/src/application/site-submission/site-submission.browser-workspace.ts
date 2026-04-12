import {
  type CreateSubmissionFormState,
  ensureSingleDefaultFeedDrafts,
  guessDefaultFeedUrl,
  guessDefaultLinkPageUrl,
  guessDefaultSitemapUrl,
  isHttpUrl,
  type SiteAutoFillResult,
  trimText,
  type UpdateSubmissionFormState,
} from './site-submission.service';

export type AutoFillFieldKey = 'name' | 'sign' | 'feeds' | 'sitemap' | 'linkPage' | 'architecture';

export type AutoFillMissingState = Record<AutoFillFieldKey, boolean>;

export const createEmptyAutoFillMissingState = (): AutoFillMissingState => ({
  name: false,
  sign: false,
  feeds: false,
  sitemap: false,
  linkPage: false,
  architecture: false,
});

export function normalizeComparableUrl(value: string): string | null {
  if (!isHttpUrl(value)) {
    return null;
  }

  try {
    const parsed = new URL(trimText(value));
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.origin}${pathname}`.toLowerCase();
  } catch {
    return null;
  }
}

export function isSameAsSiteUrl(siteUrl: string, candidateUrl: string): boolean {
  const site = normalizeComparableUrl(siteUrl);
  const candidate = normalizeComparableUrl(candidateUrl);

  if (!site || !candidate) {
    return false;
  }

  return site === candidate;
}

export function withInputStateClass(
  baseClass: string,
  warned: boolean,
  missing: boolean,
  missingInputClass: string,
  warnedInputClass: string,
): string {
  const classes = [baseClass];

  if (missing) {
    classes.push(missingInputClass);
  }

  if (warned) {
    classes.push(warnedInputClass);
  }

  return classes.join(' ');
}

export function evaluateAutoFillResult(data: SiteAutoFillResult): {
  successCount: number;
  missing: AutoFillMissingState;
} {
  const hasName = Boolean(trimText(data.name));
  const hasSign = Boolean(trimText(data.sign));
  const hasFeeds = data.feed_candidates.length > 0;
  const hasSitemap = Boolean(trimText(data.sitemap));
  const hasLinkPage = Boolean(trimText(data.link_page));
  const hasArchitecture = Boolean(
    trimText(data.architecture?.program_id ?? '') ||
    trimText(data.architecture?.program_name ?? ''),
  );

  const missing: AutoFillMissingState = {
    name: !hasName,
    sign: !hasSign,
    feeds: !hasFeeds,
    sitemap: !hasSitemap,
    linkPage: !hasLinkPage,
    architecture: !hasArchitecture,
  };

  const successCount = [
    hasName,
    hasSign,
    hasFeeds,
    hasSitemap,
    hasLinkPage,
    hasArchitecture,
  ].filter(Boolean).length;

  return {
    successCount,
    missing,
  };
}

export function syncUrlSuggestions(
  form: CreateSubmissionFormState | UpdateSubmissionFormState,
  previousUrl: string,
  nextUrl: string,
): void {
  const previousFeed = guessDefaultFeedUrl(previousUrl);
  const previousSitemap = guessDefaultSitemapUrl(previousUrl);
  const previousLinkPage = guessDefaultLinkPageUrl(previousUrl);
  const previousBase = trimText(previousUrl);
  const nextBase = isHttpUrl(nextUrl) ? trimText(nextUrl) : '';

  const shouldReset = (value: string, candidates: string[]): boolean => {
    const normalized = trimText(value);

    if (!normalized) {
      return true;
    }

    return candidates.some((candidate) => trimText(candidate) === normalized);
  };

  if (form.feeds[0]) {
    const currentUrl = trimText(form.feeds[0].url);

    if (shouldReset(currentUrl, [previousBase, previousFeed])) {
      form.feeds[0].url = nextBase;
    }
    form.feeds = ensureSingleDefaultFeedDrafts(form.feeds);
  }

  if (shouldReset(trimText(form.sitemap), [previousBase, previousSitemap])) {
    form.sitemap = nextBase;
  }

  if (shouldReset(trimText(form.link_page), [previousBase, previousLinkPage])) {
    form.link_page = nextBase;
  }
}

export function applyAutoFillToForm(
  form: CreateSubmissionFormState | UpdateSubmissionFormState,
  data: SiteAutoFillResult,
  onProgramPickerSync: (value: string) => void,
): void {
  form.name = trimText(data.name) || form.name;
  form.sign = trimText(data.sign) || form.sign;
  form.sitemap = trimText(data.sitemap) || form.sitemap;
  form.link_page = trimText(data.link_page) || form.link_page;

  if (data.feed_candidates.length > 0) {
    form.feeds = ensureSingleDefaultFeedDrafts(
      data.feed_candidates.map((item, index) => ({
        id: `${index + 1}-${Math.random().toString(36).slice(2, 6)}`,
        name:
          trimText(item.name) ||
          (data.feed_candidates.length === 1 ? '默认订阅' : `订阅源 ${index + 1}`),
        url: trimText(item.url),
        type: 'RSS',
        isDefault: index === 0,
      })),
    );
  }

  if (data.architecture?.program_id && !trimText(form.architecture_program_id)) {
    form.architecture_program_id = data.architecture.program_id;
    onProgramPickerSync(data.architecture.program_id);
  }

  if (data.architecture?.program_name && !trimText(form.architecture_program_name)) {
    form.architecture_program_name = data.architecture.program_name;
    if (!trimText(form.architecture_program_id)) {
      onProgramPickerSync('');
    }
  }

  if (typeof data.architecture?.program_is_open_source === 'boolean') {
    form.architecture_program_is_open_source = data.architecture.program_is_open_source;
  }

  const frameworkIds = (data.architecture?.stacks ?? [])
    .filter((item) => item.category === 'FRAMEWORK')
    .map((item) => trimText(item.catalog_id ?? ''))
    .filter(Boolean);
  const frameworkCustomNames = (data.architecture?.stacks ?? [])
    .filter((item) => item.category === 'FRAMEWORK')
    .filter((item) => !trimText(item.catalog_id ?? ''))
    .map((item) => trimText(item.name ?? ''))
    .filter(Boolean);

  if (frameworkIds.length > 0 || frameworkCustomNames.length > 0) {
    form.architecture_framework_ids = [
      ...new Set([...form.architecture_framework_ids, ...frameworkIds]),
    ];
    form.architecture_framework_custom_names = [
      ...new Set([...form.architecture_framework_custom_names, ...frameworkCustomNames]),
    ];
  }

  const languageIds = (data.architecture?.stacks ?? [])
    .filter((item) => item.category === 'LANGUAGE')
    .map((item) => trimText(item.catalog_id ?? ''))
    .filter(Boolean);
  const languageCustomNames = (data.architecture?.stacks ?? [])
    .filter((item) => item.category === 'LANGUAGE')
    .filter((item) => !trimText(item.catalog_id ?? ''))
    .map((item) => trimText(item.name ?? ''))
    .filter(Boolean);

  if (languageIds.length > 0 || languageCustomNames.length > 0) {
    form.architecture_language_ids = [
      ...new Set([...form.architecture_language_ids, ...languageIds]),
    ];
    form.architecture_language_custom_names = [
      ...new Set([...form.architecture_language_custom_names, ...languageCustomNames]),
    ];
  }
}
