import {
  ProgramTechnologyStacks,
  SiteArchitectures,
  type SiteAuditArchitectureSnapshot,
  type SiteAuditSnapshot,
  SiteTags,
  TechnologyCatalogs,
} from '@zhblogs/db';

import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  ensureProgramByInput,
  ensureSubTagIdsBySnapshot,
  ensureTechnologyCatalogIdByInput,
  normalizeArchitectureName,
  normalizeArchitectureToken,
} from './site-architecture-catalog.usecase';

type ResolvedArchitectureItems = Array<{
  category: 'FRAMEWORK' | 'LANGUAGE';
  catalog_id: string | null;
  name_custom: string | null;
  name_normalized: string;
}>;

async function resolveArchitectureItems(
  app: FastifyInstance,
  items: SiteAuditArchitectureSnapshot['stacks'],
): Promise<ResolvedArchitectureItems> {
  const normalizedItems = (items ?? [])
    .map((item) => {
      const catalogId = item.catalog_id ?? null;
      const customName = normalizeArchitectureName(item.name);
      const token = normalizeArchitectureToken(item.name_normalized ?? item.name);
      return { category: item.category, catalogId, customName, token };
    })
    .filter((item) => item.catalogId || item.customName);

  const catalogIds = normalizedItems.map((item) => item.catalogId).filter(Boolean) as string[];
  const catalogRows =
    catalogIds.length > 0
      ? await app.db.read
          .select({
            id: TechnologyCatalogs.id,
            name: TechnologyCatalogs.name,
            technology_type: TechnologyCatalogs.technology_type,
          })
          .from(TechnologyCatalogs)
          .where(inArray(TechnologyCatalogs.id, catalogIds))
      : [];

  const catalogById = new Map(catalogRows.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const resolved: ResolvedArchitectureItems = [];

  for (const item of normalizedItems) {
    let catalogId = item.catalogId;
    const catalog = catalogId ? (catalogById.get(catalogId) ?? null) : null;
    const catalogName = catalog?.name ?? null;

    if (catalog && catalog.technology_type !== item.category) {
      continue;
    }

    if (!catalog && item.customName) {
      const ensuredCatalogId = await ensureTechnologyCatalogIdByInput(
        app,
        item.category as 'FRAMEWORK' | 'LANGUAGE',
        null,
        item.customName,
      );
      if (ensuredCatalogId) {
        catalogId = ensuredCatalogId;
      }
    }

    const normalizedName =
      item.token ??
      normalizeArchitectureToken(item.customName) ??
      normalizeArchitectureToken(catalogName);

    if (!normalizedName) {
      continue;
    }

    const uniqueKey = `${item.category}:${normalizedName}`;

    if (seen.has(uniqueKey)) {
      continue;
    }

    seen.add(uniqueKey);
    resolved.push({
      category: item.category as 'FRAMEWORK' | 'LANGUAGE',
      catalog_id: catalogId,
      name_custom: item.customName,
      name_normalized: normalizedName,
    });
  }

  return resolved.slice(0, 10);
}

async function resolveApprovedArchitecture(
  app: FastifyInstance,
  architecture: SiteAuditArchitectureSnapshot | null | undefined,
) {
  if (!architecture) {
    return null;
  }

  const selectedProgramId = architecture.program_id?.trim() ?? null;

  if (selectedProgramId) {
    return {
      program_id: selectedProgramId,
      sync_program_stacks: false,
      stacks: [] as ResolvedArchitectureItems,
    };
  }

  const program = await ensureProgramByInput(
    app,
    architecture.program_id,
    architecture.program_name,
    architecture.program_is_open_source,
    architecture.website_url,
    architecture.repo_url,
  );

  if (!program.program_id) {
    return null;
  }

  const stacks = await resolveArchitectureItems(app, architecture.stacks ?? []);

  return {
    program_id: program.program_id,
    sync_program_stacks: true,
    stacks,
  };
}

export async function syncSiteTags(
  app: FastifyInstance,
  siteId: string,
  snapshot: SiteAuditSnapshot,
) {
  const tagIds = [
    ...(snapshot.main_tag?.tag_id ? [snapshot.main_tag.tag_id] : []),
    ...(await ensureSubTagIdsBySnapshot(app, snapshot.sub_tags)),
  ];

  await app.db.write.delete(SiteTags).where(eq(SiteTags.site_id, siteId));

  if (tagIds.length === 0) {
    return;
  }

  await app.db.write.insert(SiteTags).values(
    [...new Set(tagIds)].map((tag_id) => ({
      site_id: siteId,
      tag_id,
    })),
  );
}

export async function syncSiteArchitecture(
  app: FastifyInstance,
  siteId: string,
  snapshot: SiteAuditSnapshot,
) {
  const resolved = await resolveApprovedArchitecture(app, snapshot.architecture);

  await app.db.write.delete(SiteArchitectures).where(eq(SiteArchitectures.site_id, siteId));

  if (!resolved) {
    return;
  }

  await app.db.write.insert(SiteArchitectures).values({
    site_id: siteId,
    program_id: resolved.program_id,
  });

  if (!resolved.sync_program_stacks) {
    return;
  }

  await app.db.write
    .delete(ProgramTechnologyStacks)
    .where(eq(ProgramTechnologyStacks.program_id, resolved.program_id));

  if (resolved.stacks.length === 0) {
    return;
  }

  await app.db.write.insert(ProgramTechnologyStacks).values(
    resolved.stacks.map((item) => ({
      program_id: resolved.program_id,
      category: item.category,
      catalog_id: item.catalog_id,
      name_custom: item.catalog_id ? null : item.name_custom,
      name_normalized: item.name_normalized,
    })),
  );
}

export { resolveArchitectureItems };
