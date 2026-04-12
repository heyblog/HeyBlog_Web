import {
  Programs,
  ProgramTechnologyStacks,
  SiteArchitectures,
  type SiteAuditArchitectureSnapshot,
  type SiteAuditSnapshot,
  Sites,
  SiteTags,
  TagDefinitions,
  TechnologyCatalogs,
} from '@zhblogs/db';

import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  normalizeArchitectureSnapshot,
  normalizeSubTagSnapshots,
  normalizeSubTagToken,
  normalizeTagSnapshot,
} from '@/domain/sites/service/site-snapshot-diff.service';
import { normalizeSubmittedFeeds } from '@/domain/sites/service/site-submission-validation.service';

type TagDefinitionSnapshotRow = {
  id: string;
  name: string;
  tag_type: 'MAIN' | 'SUB';
};

type TechnologyCatalogSnapshotRow = {
  id: string;
  name: string;
  name_normalized: string;
  technology_type: 'FRAMEWORK' | 'LANGUAGE';
};

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeSnapshotSources(
  sources: SiteAuditSnapshot['from'],
): SiteAuditSnapshot['from'] | null {
  if (!Array.isArray(sources)) {
    return null;
  }

  const normalized = [
    ...new Set(
      sources
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean) as string[],
    ),
  ];

  return normalized.length > 0 ? (normalized as SiteAuditSnapshot['from']) : null;
}

function mapTagDefinitionSnapshot(
  row: TagDefinitionSnapshotRow,
): NonNullable<SiteAuditSnapshot['main_tag']> {
  return {
    tag_id: row.id,
    name: row.name,
    name_normalized: normalizeSubTagToken(row.name),
  };
}

async function loadTagDefinitionRows(
  app: FastifyInstance,
  tagIds: string[] | null | undefined,
): Promise<TagDefinitionSnapshotRow[]> {
  if (!tagIds || tagIds.length === 0) {
    return [];
  }

  const rows = await app.db.read
    .select({
      id: TagDefinitions.id,
      name: TagDefinitions.name,
      tag_type: TagDefinitions.tag_type,
    })
    .from(TagDefinitions)
    .where(inArray(TagDefinitions.id, tagIds));

  return rows as TagDefinitionSnapshotRow[];
}

async function loadTechnologyCatalogRows(
  app: FastifyInstance,
  catalogIds: string[] | null | undefined,
): Promise<TechnologyCatalogSnapshotRow[]> {
  if (!catalogIds || catalogIds.length === 0) {
    return [];
  }

  const rows = await app.db.read
    .select({
      id: TechnologyCatalogs.id,
      name: TechnologyCatalogs.name,
      name_normalized: TechnologyCatalogs.name_normalized,
      technology_type: TechnologyCatalogs.technology_type,
    })
    .from(TechnologyCatalogs)
    .where(inArray(TechnologyCatalogs.id, catalogIds));

  return rows as TechnologyCatalogSnapshotRow[];
}

async function loadProgramArchitectureSnapshot(
  app: FastifyInstance,
  programId: string | null | undefined,
): Promise<SiteAuditArchitectureSnapshot | null> {
  const normalizedProgramId = programId?.trim() ?? null;

  if (!normalizedProgramId) {
    return null;
  }

  const [program] = await app.db.read
    .select({
      id: Programs.id,
      name: Programs.name,
      is_open_source: Programs.is_open_source,
      website_url: Programs.website_url,
      repo_url: Programs.repo_url,
    })
    .from(Programs)
    .where(eq(Programs.id, normalizedProgramId))
    .limit(1);

  if (!program) {
    return null;
  }

  const programStacks = await app.db.read
    .select({
      category: ProgramTechnologyStacks.category,
      catalog_id: ProgramTechnologyStacks.catalog_id,
      name_custom: ProgramTechnologyStacks.name_custom,
      name_normalized: ProgramTechnologyStacks.name_normalized,
    })
    .from(ProgramTechnologyStacks)
    .where(eq(ProgramTechnologyStacks.program_id, program.id));

  const stackCatalogRows = await loadTechnologyCatalogRows(
    app,
    programStacks.map((row) => row.catalog_id).filter(Boolean) as string[],
  );
  const stackCatalogById = new Map(stackCatalogRows.map((row) => [row.id, row]));

  const stacks = programStacks
    .map((row): NonNullable<SiteAuditArchitectureSnapshot['stacks']>[number] | null => {
      const category =
        row.category === 'FRAMEWORK' || row.category === 'LANGUAGE' ? row.category : null;

      if (!category) {
        return null;
      }

      const catalog = row.catalog_id ? (stackCatalogById.get(row.catalog_id) ?? null) : null;

      return {
        category,
        catalog_id: row.catalog_id ?? null,
        name: row.name_custom ?? catalog?.name ?? null,
        name_normalized: row.name_normalized ?? catalog?.name_normalized ?? null,
      };
    })
    .filter(
      (row): row is NonNullable<SiteAuditArchitectureSnapshot['stacks']>[number] => row !== null,
    );

  return {
    program_id: program.id,
    program_name: program.name,
    program_is_open_source: program.is_open_source ?? null,
    stacks: stacks.length > 0 ? stacks : null,
    website_url: program.website_url ?? null,
    repo_url: program.repo_url ?? null,
  };
}

async function resolveSnapshotArchitecture(
  app: FastifyInstance,
  architecture: SiteAuditSnapshot['architecture'],
): Promise<SiteAuditSnapshot['architecture']> {
  const normalized = normalizeArchitectureSnapshot(architecture);

  if (!normalized) {
    return null;
  }

  if (normalized.program_id) {
    return (await loadProgramArchitectureSnapshot(app, normalized.program_id)) ?? normalized;
  }

  const stackCatalogRows = await loadTechnologyCatalogRows(
    app,
    normalized.stacks?.map((item) => item.catalog_id).filter(Boolean) as string[] | undefined,
  );
  const stackCatalogById = new Map(stackCatalogRows.map((row) => [row.id, row]));

  return {
    ...normalized,
    stacks:
      normalized.stacks?.map((item) => {
        const catalog = item.catalog_id ? (stackCatalogById.get(item.catalog_id) ?? null) : null;

        return {
          category: catalog?.technology_type ?? item.category,
          catalog_id: item.catalog_id ?? null,
          name: catalog?.name ?? item.name ?? null,
          name_normalized:
            catalog?.name_normalized ??
            normalizeSubTagToken(item.name_normalized ?? item.name) ??
            null,
        };
      }) ?? null,
  };
}

export async function materializeSiteAuditSnapshot(
  app: FastifyInstance,
  snapshot: SiteAuditSnapshot,
): Promise<SiteAuditSnapshot> {
  const normalizedMainTag = normalizeTagSnapshot(snapshot.main_tag ?? null);
  const normalizedSubTags = normalizeSubTagSnapshots(snapshot.sub_tags);
  const tagIds = [
    ...(normalizedMainTag?.tag_id ? [normalizedMainTag.tag_id] : []),
    ...((normalizedSubTags ?? []).map((item) => item.tag_id).filter(Boolean) as string[]),
  ];
  const tagDefinitionRows = await loadTagDefinitionRows(app, [...new Set(tagIds)]);
  const tagDefinitionById = new Map(tagDefinitionRows.map((row) => [row.id, row]));
  const mainTagRow = normalizedMainTag?.tag_id
    ? (tagDefinitionById.get(normalizedMainTag.tag_id) ?? null)
    : null;
  const architecture = await resolveSnapshotArchitecture(app, snapshot.architecture);
  const effectiveMainTag = mainTagRow ? mapTagDefinitionSnapshot(mainTagRow) : normalizedMainTag;

  return {
    ...snapshot,
    bid: normalizeOptionalString(snapshot.bid),
    name: snapshot.name?.trim() ?? '',
    url: snapshot.url?.trim() ?? '',
    sign: normalizeOptionalString(snapshot.sign),
    icon_base64: normalizeOptionalString(snapshot.icon_base64),
    feed: normalizeSubmittedFeeds(snapshot.feed),
    from: normalizeSnapshotSources(snapshot.from),
    classification_status: effectiveMainTag?.tag_id ? 'COMPLETE' : 'NEEDS_REVIEW',
    sitemap: normalizeOptionalString(snapshot.sitemap),
    link_page: normalizeOptionalString(snapshot.link_page),
    access_scope: snapshot.access_scope ?? null,
    status: snapshot.status ?? null,
    is_show: typeof snapshot.is_show === 'boolean' ? snapshot.is_show : null,
    recommend: typeof snapshot.recommend === 'boolean' ? snapshot.recommend : null,
    reason: normalizeOptionalString(snapshot.reason),
    main_tag: effectiveMainTag,
    sub_tags:
      normalizedSubTags?.map((item) => {
        const row = item.tag_id ? (tagDefinitionById.get(item.tag_id) ?? null) : null;

        if (row) {
          return mapTagDefinitionSnapshot(row);
        }

        return {
          tag_id: item.tag_id ?? null,
          name: item.name ?? null,
          name_normalized: normalizeSubTagToken(item.name_normalized ?? item.name) ?? null,
        };
      }) ?? null,
    architecture,
  };
}

export async function loadCurrentSiteSnapshot(
  app: FastifyInstance,
  siteId: string,
): Promise<SiteAuditSnapshot | null> {
  const [site] = await app.db.read.select().from(Sites).where(eq(Sites.id, siteId)).limit(1);

  if (!site) {
    return null;
  }

  const tagRows = await app.db.read
    .select({ tag_id: SiteTags.tag_id })
    .from(SiteTags)
    .where(eq(SiteTags.site_id, siteId));

  const tagDefinitionRows = await loadTagDefinitionRows(
    app,
    tagRows.map((row) => row.tag_id),
  );

  const [architecture] = await app.db.read
    .select({
      program_id: SiteArchitectures.program_id,
    })
    .from(SiteArchitectures)
    .where(eq(SiteArchitectures.site_id, siteId))
    .limit(1);

  const mainTagRow = tagDefinitionRows.find((row) => row.tag_type === 'MAIN') ?? null;
  const subTags = tagDefinitionRows
    .filter((row) => row.tag_type === 'SUB')
    .map(mapTagDefinitionSnapshot)
    .sort((left, right) => (left.tag_id ?? '').localeCompare(right.tag_id ?? '', 'zh-CN'));

  return {
    bid: site.bid ?? null,
    name: site.name,
    url: site.url,
    sign: site.sign ?? null,
    icon_base64: site.icon_base64 ?? null,
    feed: normalizeSubmittedFeeds(site.feed ?? []),
    from: (site.from ?? null) as SiteAuditSnapshot['from'],
    classification_status: site.classification_status as SiteAuditSnapshot['classification_status'],
    sitemap: site.sitemap ?? null,
    link_page: site.link_page ?? null,
    access_scope: site.access_scope as SiteAuditSnapshot['access_scope'],
    status: site.status as SiteAuditSnapshot['status'],
    is_show: site.is_show,
    recommend: site.recommend ?? false,
    reason: site.reason ?? null,
    main_tag: mainTagRow ? mapTagDefinitionSnapshot(mainTagRow) : null,
    sub_tags: subTags.length > 0 ? subTags : null,
    architecture: architecture
      ? await loadProgramArchitectureSnapshot(app, architecture.program_id)
      : null,
  };
}
