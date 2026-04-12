import {
  Programs,
  SiteAudits,
  type SiteAuditSnapshot,
  Sites,
  TagDefinitions,
  TechnologyCatalogs,
} from '@zhblogs/db';

import { and, desc, eq, ilike, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import type { SiteAutoFillHints } from '@/domain/sites/types/site-auto-fill.types';

export interface ActiveSubmissionSummary {
  audit_id: string;
  action: string;
  status: string;
  created_time: string;
  site_id: string | null;
}

type PendingAuditSummaryRow = {
  id: string;
  action: string;
  status: string;
  created_time: Date;
  site_id: string | null;
};

const toActiveSubmissionSummary = (audit: PendingAuditSummaryRow): ActiveSubmissionSummary => ({
  audit_id: audit.id,
  action: audit.action,
  status: audit.status,
  created_time: audit.created_time.toISOString(),
  site_id: audit.site_id,
});

const normalizeIdentifierText = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const matchesPendingCreateSubmission = (
  snapshot: SiteAuditSnapshot | null | undefined,
  target: Pick<SiteAuditSnapshot, 'url' | 'bid'>,
): boolean => {
  const url = normalizeIdentifierText(target.url);
  const bid = normalizeIdentifierText(target.bid);

  if (!url && !bid) {
    return false;
  }

  return (
    (url !== null && normalizeIdentifierText(snapshot?.url) === url) ||
    (bid !== null && normalizeIdentifierText(snapshot?.bid) === bid)
  );
};

export async function hasPendingSiteAudit(app: FastifyInstance, siteId: string): Promise<boolean> {
  const [audit] = await app.db.read
    .select({ id: SiteAudits.id })
    .from(SiteAudits)
    .where(
      and(
        eq(SiteAudits.site_id, siteId),
        eq(SiteAudits.status, 'PENDING'),
        or(eq(SiteAudits.action, 'UPDATE'), eq(SiteAudits.action, 'DELETE')),
      ),
    )
    .limit(1);

  return Boolean(audit);
}

export async function loadPendingSiteAuditSummary(
  app: FastifyInstance,
  siteId: string,
): Promise<ActiveSubmissionSummary | null> {
  const [audit] = await app.db.read
    .select({
      id: SiteAudits.id,
      action: SiteAudits.action,
      status: SiteAudits.status,
      created_time: SiteAudits.created_time,
      site_id: SiteAudits.site_id,
    })
    .from(SiteAudits)
    .where(
      and(
        eq(SiteAudits.site_id, siteId),
        eq(SiteAudits.status, 'PENDING'),
        or(
          eq(SiteAudits.action, 'UPDATE'),
          eq(SiteAudits.action, 'DELETE'),
          eq(SiteAudits.action, 'RESTORE'),
        ),
      ),
    )
    .orderBy(desc(SiteAudits.created_time))
    .limit(1);

  return audit ? toActiveSubmissionSummary(audit) : null;
}

export async function loadPendingCreateAuditSummary(
  app: FastifyInstance,
  snapshot: Pick<SiteAuditSnapshot, 'url' | 'bid'>,
): Promise<ActiveSubmissionSummary | null> {
  const rows = await app.db.read
    .select({
      id: SiteAudits.id,
      action: SiteAudits.action,
      status: SiteAudits.status,
      created_time: SiteAudits.created_time,
      site_id: SiteAudits.site_id,
      proposed_snapshot: SiteAudits.proposed_snapshot,
    })
    .from(SiteAudits)
    .where(and(eq(SiteAudits.status, 'PENDING'), eq(SiteAudits.action, 'CREATE')))
    .orderBy(desc(SiteAudits.created_time))
    .limit(40);

  const matched = rows.find((row) =>
    matchesPendingCreateSubmission(
      row.proposed_snapshot as SiteAuditSnapshot | null | undefined,
      snapshot,
    ),
  );

  return matched ? toActiveSubmissionSummary(matched) : null;
}

export async function loadSiteSearchResults(app: FastifyInstance, query: string) {
  return app.db.read
    .select({
      site_id: Sites.id,
      bid: Sites.bid,
      name: Sites.name,
      url: Sites.url,
    })
    .from(Sites)
    .where(
      and(
        eq(Sites.is_show, true),
        or(ilike(Sites.name, `%${query}%`), ilike(Sites.url, `%${query}%`)),
      ),
    )
    .limit(12);
}

function deriveSameOriginPathHint(
  siteUrl: string | null | undefined,
  targetUrl: string | null | undefined,
): string | null {
  if (!siteUrl || !targetUrl) {
    return null;
  }

  try {
    const site = new URL(siteUrl);
    const target = new URL(targetUrl);

    if (site.origin !== target.origin) {
      return null;
    }

    const path = `${target.pathname}${target.search}`.trim();
    return path && path !== '/' ? path : null;
  } catch {
    return null;
  }
}

function rankAutoFillPathHints(
  values: Array<string | null | undefined>,
  defaults: string[],
): string[] {
  const countByPath = new Map<string, number>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    countByPath.set(value, (countByPath.get(value) ?? 0) + 1);
  }

  const ranked = [...countByPath.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], 'zh-CN');
    })
    .map(([path]) => path);

  const seen = new Set<string>();
  const merged: string[] = [];

  for (const value of [...ranked, ...defaults]) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    merged.push(value);
  }

  return merged.slice(0, 8);
}

export async function loadAutoFillHints(app: FastifyInstance): Promise<SiteAutoFillHints> {
  const rows = await app.db.read
    .select({
      url: Sites.url,
      feed: Sites.feed,
      sitemap: Sites.sitemap,
      link_page: Sites.link_page,
    })
    .from(Sites)
    .where(eq(Sites.is_show, true))
    .limit(500);

  const feedPaths = rows.flatMap((row) =>
    (row.feed ?? []).map((feedItem) => deriveSameOriginPathHint(row.url, feedItem?.url ?? null)),
  );
  const sitemapPaths = rows.map((row) => deriveSameOriginPathHint(row.url, row.sitemap));
  const linkPagePaths = rows.map((row) => deriveSameOriginPathHint(row.url, row.link_page));

  return {
    feed_paths: rankAutoFillPathHints(feedPaths, [
      '/feed',
      '/feed.xml',
      '/rss.xml',
      '/atom.xml',
      '/index.xml',
    ]),
    sitemap_paths: rankAutoFillPathHints(sitemapPaths, ['/sitemap.xml', '/sitemap_index.xml']),
    link_page_paths: rankAutoFillPathHints(linkPagePaths, ['/friends', '/links', '/friend-links']),
  };
}

export async function loadSubmissionOptions(app: FastifyInstance) {
  const [tags, programs, technologies] = await Promise.all([
    app.db.read
      .select({
        id: TagDefinitions.id,
        name: TagDefinitions.name,
        tag_type: TagDefinitions.tag_type,
      })
      .from(TagDefinitions)
      .where(
        and(
          eq(TagDefinitions.is_enabled, true),
          or(eq(TagDefinitions.tag_type, 'MAIN'), eq(TagDefinitions.tag_type, 'SUB')),
        ),
      ),
    app.db.read
      .select({
        id: Programs.id,
        name: Programs.name,
      })
      .from(Programs)
      .where(eq(Programs.is_enabled, true)),
    app.db.read
      .select({
        id: TechnologyCatalogs.id,
        name: TechnologyCatalogs.name,
        technology_type: TechnologyCatalogs.technology_type,
      })
      .from(TechnologyCatalogs)
      .where(
        and(
          eq(TechnologyCatalogs.is_enabled, true),
          or(
            eq(TechnologyCatalogs.technology_type, 'FRAMEWORK'),
            eq(TechnologyCatalogs.technology_type, 'LANGUAGE'),
          ),
        ),
      ),
  ]);

  return {
    main_tags: tags.filter((row) => row.tag_type === 'MAIN').map(({ id, name }) => ({ id, name })),
    sub_tags: tags.filter((row) => row.tag_type === 'SUB').map(({ id, name }) => ({ id, name })),
    programs: programs.map(({ id, name }) => ({ id, name })),
    tech_stacks: technologies.map(({ id, name, technology_type }) => ({
      id,
      name,
      category: technology_type,
    })),
  };
}
