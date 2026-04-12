import { createComparableHttpUrlKey } from './site-submission.core';

export function ensureSingleDefaultFeedSelection<T extends { id: string; isDefault: boolean }>(
  feeds: T[],
  selectedId?: string | null,
): T[] {
  if (feeds.length === 0) {
    return [];
  }

  if (feeds.length === 1) {
    return feeds.map((feed) => ({
      ...feed,
      isDefault: true,
    }));
  }

  const fallbackId = feeds.find((feed) => feed.isDefault)?.id ?? feeds[0]?.id ?? null;
  const targetId =
    selectedId && feeds.some((feed) => feed.id === selectedId) ? selectedId : fallbackId;

  return feeds.map((feed) => ({
    ...feed,
    isDefault: feed.id === targetId,
  }));
}

export function shouldPromptDefaultFeedSelection(
  feeds: Array<{ url: string; isDefault?: boolean }>,
): boolean {
  const uniqueFeedUrls = new Set(
    feeds
      .map((feed) => createComparableHttpUrlKey(feed.url))
      .filter((value): value is string => Boolean(value)),
  );

  if (uniqueFeedUrls.size <= 1) {
    return false;
  }

  return (
    feeds.filter((feed) => feed.isDefault && createComparableHttpUrlKey(feed.url)).length !== 1
  );
}

export function formatFeedIndex(index: number): string {
  return String(index + 1).padStart(2, '0');
}
