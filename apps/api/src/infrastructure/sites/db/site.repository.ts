import {
  Programs,
  type SiteAuditArchitectureSnapshot,
  type SiteAuditSnapshot,
  Sites,
  TagDefinitions,
  TechnologyCatalogs,
} from '@zhblogs/db';

import { and, eq, inArray, ne } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  mapStrongDuplicateFields,
  reviewSiteDuplicates,
  type SiteDuplicateReviewResult,
} from '@/domain/sites/service/site-duplicate-review.service';

export { loadCurrentSiteSnapshot, materializeSiteAuditSnapshot } from './site-snapshot.repository';

type ArchitectureInput =
  | { program_id?: string | null }
  | SiteAuditArchitectureSnapshot
  | null
  | undefined;

function hasArchitectureStacks(
  architecture: ArchitectureInput,
): architecture is SiteAuditArchitectureSnapshot {
  return Boolean(architecture && 'stacks' in architecture);
}

export async function ensureTagIdsExist(
  app: FastifyInstance,
  tagIds: string[] | null | undefined,
): Promise<boolean> {
  if (!tagIds || tagIds.length === 0) {
    return true;
  }

  const rows = await app.db.read
    .select({ id: TagDefinitions.id })
    .from(TagDefinitions)
    .where(and(inArray(TagDefinitions.id, tagIds), eq(TagDefinitions.is_enabled, true)));

  return new Set(rows.map((row) => row.id)).size === new Set(tagIds).size;
}

export async function ensureTechnologyIdsExist(
  app: FastifyInstance,
  architecture: ArchitectureInput,
): Promise<boolean> {
  if (!architecture) {
    return true;
  }

  if (architecture.program_id) {
    const [program] = await app.db.read
      .select({ id: Programs.id })
      .from(Programs)
      .where(and(eq(Programs.id, architecture.program_id), eq(Programs.is_enabled, true)))
      .limit(1);

    if (!program) {
      return false;
    }

    return true;
  }

  const stackItems = hasArchitectureStacks(architecture)
    ? Array.isArray(architecture.stacks)
      ? architecture.stacks
      : []
    : [];
  const catalogIds = [
    ...new Set(stackItems.map((item) => item.catalog_id).filter(Boolean)),
  ] as string[];

  if (catalogIds.length === 0) {
    return true;
  }

  const rows = await app.db.read
    .select({
      id: TechnologyCatalogs.id,
      technology_type: TechnologyCatalogs.technology_type,
    })
    .from(TechnologyCatalogs)
    .where(
      and(inArray(TechnologyCatalogs.id, catalogIds), eq(TechnologyCatalogs.is_enabled, true)),
    );

  const catalogTypeById = new Map(rows.map((row) => [row.id, row.technology_type]));

  return stackItems.every((item) => {
    if (!item.catalog_id) {
      return true;
    }

    const catalogType = catalogTypeById.get(item.catalog_id);
    return catalogType === 'FRAMEWORK' || catalogType === 'LANGUAGE'
      ? catalogType === item.category
      : false;
  });
}

export async function ensureNoSiteIdentifierConflict(
  app: FastifyInstance,
  snapshot: Pick<SiteAuditSnapshot, 'bid' | 'name' | 'url'>,
  currentSiteId?: string,
): Promise<Array<'bid' | 'url'> | null> {
  const review = await reviewSubmittedSiteDuplicates(app, snapshot, currentSiteId);
  return mapStrongDuplicateFields(review.strong);
}

export async function reviewSubmittedSiteDuplicates(
  app: FastifyInstance,
  snapshot: Pick<SiteAuditSnapshot, 'bid' | 'name' | 'url'>,
  currentSiteId?: string,
): Promise<SiteDuplicateReviewResult> {
  const rows = await app.db.read
    .select({
      id: Sites.id,
      bid: Sites.bid,
      name: Sites.name,
      url: Sites.url,
      is_show: Sites.is_show,
    })
    .from(Sites)
    .where(currentSiteId ? ne(Sites.id, currentSiteId) : undefined);

  return reviewSiteDuplicates(rows, snapshot);
}

export async function loadHiddenSiteRestoreTarget(app: FastifyInstance, siteId: string) {
  const [site] = await app.db.read
    .select({
      site_id: Sites.id,
      bid: Sites.bid,
      name: Sites.name,
      url: Sites.url,
      reason: Sites.reason,
      is_show: Sites.is_show,
    })
    .from(Sites)
    .where(eq(Sites.id, siteId))
    .limit(1);

  if (!site || site.is_show) {
    return null;
  }

  return {
    site_id: site.site_id,
    bid: site.bid,
    name: site.name,
    url: site.url,
    reason: site.reason,
  };
}
