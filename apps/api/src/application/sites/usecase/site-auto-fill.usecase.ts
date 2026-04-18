import type { MultiFeed } from '@zhblogs/db';

import { detectArchitecture } from '@/domain/sites/service/site-architecture-detector.service';
import {
  collectFeedCandidates,
  collectLinkPageCandidates,
  pickDescription,
  pickDescriptionFromTitle,
  pickTitle,
} from '@/domain/sites/service/site-auto-fill-extractor.service';
import type {
  SiteAutoFillHints,
  SiteAutoFillResult,
} from '@/domain/sites/types/site-auto-fill.types';
import {
  dedupeFeedsByFingerprint,
  fetchText,
  validateAndFingerprintFeedCandidate,
  type ValidatedFeedCandidate,
  validateLinkPageCandidate,
  validateSitemapCandidate,
} from '@/infrastructure/sites/http/site-auto-fill-validator.service';

import { collectSitemapCandidates } from './site-sitemap.usecase';

export type {
  AutoFillArchitectureHint,
  SiteAutoFillHints,
  SiteAutoFillResult,
} from '@/domain/sites/types/site-auto-fill.types';

export async function autoFillSite(
  url: string,
  hints: SiteAutoFillHints = {},
): Promise<SiteAutoFillResult> {
  const warnings: string[] = [];
  let html = '';

  try {
    html = await fetchText(url);
  } catch {
    warnings.push(
      '未能抓取站点首页，已继续探测常用订阅、站点地图和友链页地址；未通过验证的候选不会回填。',
    );
  }

  const name = pickTitle(html);
  const sign = pickDescription(html) || pickDescriptionFromTitle(name);
  const feedCandidates = collectFeedCandidates(html, url, hints);
  const sitemapCandidates = await collectSitemapCandidates(html, url, hints);
  const linkPageCandidates = collectLinkPageCandidates(html, url, hints);
  const [validatedFeeds, validatedSitemapCandidates, validatedLinkPageCandidates] =
    await Promise.all([
      Promise.all(
        feedCandidates.map((candidate) => validateAndFingerprintFeedCandidate(candidate)),
      ),
      Promise.all(sitemapCandidates.map((candidateUrl) => validateSitemapCandidate(candidateUrl))),
      Promise.all(
        linkPageCandidates.map((candidateUrl) => validateLinkPageCandidate(candidateUrl)),
      ),
    ]);

  const validFeeds = validatedFeeds.filter((item): item is ValidatedFeedCandidate => Boolean(item));
  const dedupedFeeds = dedupeFeedsByFingerprint(validFeeds);
  const feed: MultiFeed[] = dedupedFeeds.feeds.map((item, index) => ({
    name: index === 0 ? '默认订阅' : `订阅 ${index + 1}`,
    url: item.url,
    type: item.type,
    isDefault: index === 0,
  }));
  const sitemap = validatedSitemapCandidates.find((item): item is string => Boolean(item)) ?? '';
  const linkPage = validatedLinkPageCandidates.find((item): item is string => Boolean(item)) ?? '';

  if (dedupedFeeds.removedCount > 0) {
    warnings.push(
      `检测到 ${dedupedFeeds.removedCount} 个内容重复的订阅源，已按优先级保留最佳来源。`,
    );
  }

  if (html && !name && !sign) {
    warnings.push('页面可访问，但暂未识别到可直接回填的站点名称或简介。');
  }

  if (feed.length === 0) {
    warnings.push('未识别到可访问且内容有效的订阅地址。');
  }

  if (!sitemap) {
    warnings.push('未识别到可访问且内容有效的网站地图。');
  }

  if (!linkPage) {
    warnings.push('未识别到可访问且内容有效的友链页面。');
  }

  return {
    name,
    sign,
    feed_candidates: feed.map((item) => ({
      name: item.name,
      url: item.url,
    })),
    sitemap,
    link_page: linkPage,
    architecture: detectArchitecture(html),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
