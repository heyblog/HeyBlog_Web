import { and, eq, inArray } from 'drizzle-orm';

import { TagDefinitions } from '../src/schema/catalogs';
import { Programs, SiteArchitectures, Sites, SiteTags } from '../src/schema/sites';

import {
  type MainTagResolution,
  mapFromSources,
  mapMainTag,
  mapStatus,
  type MigrationStats,
  normalizeLabel,
  normalizeProgramToken,
  type OldBlog,
  sanitizeFeeds,
  type Transaction,
} from './migrate-legacy-blogs.shared';

const selectTagDefinitions = async (tx: Transaction, names: string[], tagType: 'MAIN' | 'SUB') => {
  if (names.length === 0) {
    return [];
  }

  return tx
    .select({ id: TagDefinitions.id, name: TagDefinitions.name })
    .from(TagDefinitions)
    .where(
      and(
        eq(TagDefinitions.tag_type, tagType),
        names.length === 1
          ? eq(TagDefinitions.name, names[0]!)
          : inArray(TagDefinitions.name, names),
      ),
    );
};

const fillNameIdMap = (rows: Array<{ id: string; name: string }>, target: Map<string, string>) => {
  for (const row of rows) {
    target.set(row.name, row.id);
  }
};

const fillTokenIdMap = (
  rows: Array<{ id: string; token: string }>,
  target: Map<string, string>,
) => {
  for (const row of rows) {
    target.set(row.token, row.id);
  }
};

export const ensureTagDefinitions = async (
  tx: Transaction,
  names: string[],
  tagType: 'MAIN' | 'SUB',
  descriptions = new Map<string, string>(),
): Promise<Map<string, string>> => {
  const uniqueNames = Array.from(new Set(names));
  const idByName = new Map<string, string>();

  fillNameIdMap(await selectTagDefinitions(tx, uniqueNames, tagType), idByName);

  const missingNames = uniqueNames.filter((name) => !idByName.has(name));
  if (missingNames.length === 0) {
    return idByName;
  }

  await tx
    .insert(TagDefinitions)
    .values(
      missingNames.map((name) => ({
        name,
        tag_type: tagType,
        description: descriptions.get(name),
        is_enabled: true,
      })),
    )
    .onConflictDoNothing();

  fillNameIdMap(await selectTagDefinitions(tx, missingNames, tagType), idByName);
  return idByName;
};

const buildProgramTokenMap = (names: string[]) => {
  const tokenByName = new Map<string, string>();

  for (const name of Array.from(new Set(names))) {
    const token = normalizeProgramToken(name);
    if (token) {
      tokenByName.set(name, token);
    }
  }

  return tokenByName;
};

const selectProgramsByToken = async (tx: Transaction, tokens: string[]) => {
  if (tokens.length === 0) {
    return [];
  }

  return tx
    .select({ id: Programs.id, token: Programs.name_normalized })
    .from(Programs)
    .where(
      tokens.length === 1
        ? eq(Programs.name_normalized, tokens[0]!)
        : inArray(Programs.name_normalized, tokens),
    );
};

export const ensurePrograms = async (
  tx: Transaction,
  names: string[],
): Promise<Map<string, string>> => {
  const tokenByName = buildProgramTokenMap(names);
  const idByToken = new Map<string, string>();
  const tokens = Array.from(new Set(tokenByName.values()));

  fillTokenIdMap(await selectProgramsByToken(tx, tokens), idByToken);

  const missingNames = Array.from(tokenByName.keys()).filter(
    (name) => !idByToken.has(tokenByName.get(name)!),
  );
  if (missingNames.length > 0) {
    await tx
      .insert(Programs)
      .values(
        missingNames.map((name) => ({
          name,
          name_normalized: tokenByName.get(name)!,
          is_enabled: true,
        })),
      )
      .onConflictDoNothing();

    const missingTokens = missingNames.map((name) => tokenByName.get(name)!);
    fillTokenIdMap(await selectProgramsByToken(tx, missingTokens), idByToken);
  }

  const idByName = new Map<string, string>();
  for (const [name, token] of tokenByName) {
    const id = idByToken.get(token);
    if (id) {
      idByName.set(name, id);
    }
  }

  return idByName;
};

const collectNormalizedUrls = (batch: OldBlog[]): string[] => {
  const urls = new Set<string>();

  for (const blog of batch) {
    const url = normalizeLabel(blog.url);
    if (url) {
      urls.add(url);
    }
  }

  return Array.from(urls);
};

const loadExistingUrlSet = async (tx: Transaction, batch: OldBlog[]): Promise<Set<string>> => {
  const urls = collectNormalizedUrls(batch);
  if (urls.length === 0) {
    return new Set();
  }

  const rows: Array<{ url: string }> = await tx
    .select({ url: Sites.url })
    .from(Sites)
    .where(urls.length === 1 ? eq(Sites.url, urls[0]!) : inArray(Sites.url, urls));

  return new Set(rows.map((row) => row.url));
};

const buildSiteValues = (
  blog: OldBlog,
  mainTag: MainTagResolution,
  oldJoinTime: Date,
  oldUpdateTime: Date,
) => {
  const mappedSources = mapFromSources(blog.from);
  return {
    mappedSources,
    values: {
      bid: null,
      name: blog.name,
      url: normalizeLabel(blog.url)!,
      sign: blog.sign ?? '',
      feed: sanitizeFeeds(blog.feed),
      from: mappedSources.values,
      classification_status: mainTag.classificationStatus,
      sitemap: blog.sitemap,
      link_page: blog.link_page,
      join_time: oldJoinTime,
      update_time: oldUpdateTime,
      access_scope: 'ALL' as const,
      status: mapStatus(blog.status),
      is_show: blog.passed ?? true,
      recommend: blog.recommen ?? false,
      reason: blog.reason,
    },
  };
};

const upsertSite = async (
  tx: Transaction,
  blog: OldBlog,
  mainTag: MainTagResolution,
): Promise<{ id: string; existed: boolean; unknownSourceCount: number }> => {
  const oldJoinTime = blog.join_time ?? new Date();
  const oldUpdateTime = blog.update_time ?? oldJoinTime;
  const { mappedSources, values } = buildSiteValues(blog, mainTag, oldJoinTime, oldUpdateTime);
  const existed = (await loadExistingUrlSet(tx, [blog])).has(values.url);

  const [site] = await tx
    .insert(Sites)
    .values(values)
    .onConflictDoUpdate({
      target: Sites.url,
      set: {
        bid: values.bid,
        name: values.name,
        sign: values.sign,
        feed: values.feed,
        from: values.from,
        classification_status: values.classification_status,
        sitemap: values.sitemap,
        link_page: values.link_page,
        update_time: values.update_time,
        access_scope: values.access_scope,
        status: values.status,
        is_show: values.is_show,
        recommend: values.recommend,
        reason: values.reason,
      },
    })
    .returning({ id: Sites.id });

  if (!site) {
    throw new Error(`Failed to upsert site for legacy url: ${values.url}`);
  }

  return { id: site.id, existed, unknownSourceCount: mappedSources.unknownCount };
};

const collectTagIds = (
  blog: OldBlog,
  mainTag: MainTagResolution,
  mainTagIdByLabel: Map<string, string>,
  subTagIdByLabel: Map<string, string>,
): string[] => {
  const tagIds = new Set<string>();
  const mainTagId = mainTagIdByLabel.get(mainTag.label);

  if (mainTagId) {
    tagIds.add(mainTagId);
  }

  for (const tag of blog.sub_tag ?? []) {
    const normalized = normalizeLabel(tag);
    const tagId = normalized ? subTagIdByLabel.get(normalized) : null;
    if (tagId) {
      tagIds.add(tagId);
    }
  }

  return Array.from(tagIds);
};

const syncSiteTags = async (tx: Transaction, siteId: string, tagIds: string[]) => {
  await tx.delete(SiteTags).where(eq(SiteTags.site_id, siteId));

  if (tagIds.length === 0) {
    return;
  }

  await tx
    .insert(SiteTags)
    .values(
      tagIds.map((tagId) => ({
        site_id: siteId,
        tag_id: tagId,
      })),
    )
    .onConflictDoNothing();
};

const syncSiteArchitecture = async (
  tx: Transaction,
  blog: OldBlog,
  siteId: string,
  programIdByName: Map<string, string>,
): Promise<boolean> => {
  const programName = normalizeLabel(blog.arch);
  if (!programName) {
    await tx.delete(SiteArchitectures).where(eq(SiteArchitectures.site_id, siteId));
    return false;
  }

  const programId = programIdByName.get(programName);
  if (!programId) {
    throw new Error(`Program mapping missing for "${programName}" (legacy url: ${blog.url})`);
  }

  const oldJoinTime = blog.join_time ?? new Date();
  const oldUpdateTime = blog.update_time ?? oldJoinTime;

  await tx
    .insert(SiteArchitectures)
    .values({
      site_id: siteId,
      program_id: programId,
      created_time: oldJoinTime,
      updated_time: oldUpdateTime,
    })
    .onConflictDoUpdate({
      target: SiteArchitectures.site_id,
      set: { program_id: programId, updated_time: oldUpdateTime },
    });

  return true;
};

const processLegacyBlog = async (
  tx: Transaction,
  blog: OldBlog,
  mainTagIdByLabel: Map<string, string>,
  subTagIdByLabel: Map<string, string>,
  programIdByName: Map<string, string>,
  stats: MigrationStats,
) => {
  if (!normalizeLabel(blog.url)) {
    stats.skippedInvalidUrl += 1;
    return;
  }

  const mainTag = mapMainTag(blog.main_tag);
  const tagIds = collectTagIds(blog, mainTag, mainTagIdByLabel, subTagIdByLabel);
  const site = await upsertSite(tx, blog, mainTag);
  const hasProgram = await syncSiteArchitecture(tx, blog, site.id, programIdByName);

  if (mainTag.classificationStatus === 'NEEDS_REVIEW') {
    stats.unknownMainTag += 1;
  }
  stats.unknownSource += site.unknownSourceCount;
  stats.created += site.existed ? 0 : 1;
  stats.updated += site.existed ? 1 : 0;
  stats.withProgram += hasProgram ? 1 : 0;
  stats.withoutProgram += hasProgram ? 0 : 1;

  await syncSiteTags(tx, site.id, tagIds);
  stats.processed += 1;
};

export const processBatch = async (
  tx: Transaction,
  batch: OldBlog[],
  mainTagIdByLabel: Map<string, string>,
  subTagIdByLabel: Map<string, string>,
  programIdByName: Map<string, string>,
  stats: MigrationStats,
): Promise<void> => {
  for (const blog of batch) {
    await processLegacyBlog(tx, blog, mainTagIdByLabel, subTagIdByLabel, programIdByName, stats);
  }
};
