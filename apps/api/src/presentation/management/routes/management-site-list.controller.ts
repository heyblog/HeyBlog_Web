import { Sites, SiteTags, TagDefinitions } from '@zhblogs/db';

import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  normalizeBooleanFilter,
  normalizeEnumFilter,
  normalizeOptionalString,
  normalizePagination,
  requireManagementPermission,
  toPositiveInt,
} from './management-route.shared';

type ManagedSiteListQuery = {
  q?: string;
  page?: string;
  pageSize?: string;
  classification_status?: string;
  access_scope?: string;
  status?: string;
  is_show?: string;
  recommend?: string;
  main_tag_id?: string;
};

export function registerManagementSiteListRoute(app: FastifyInstance): void {
  app.get(
    '/api/management/sites',
    {
      preHandler: requireManagementPermission('site.manage'),
    },
    async (request) => {
      const query = request.query as ManagedSiteListQuery;
      const keyword = query.q?.trim();
      const classificationStatus = normalizeEnumFilter(query.classification_status, [
        'COMPLETE',
        'NEEDS_REVIEW',
      ] as const);
      const accessScope = normalizeEnumFilter(query.access_scope, [
        'BOTH',
        'CN_ONLY',
        'GLOBAL_ONLY',
      ] as const);
      const siteStatus = normalizeEnumFilter(query.status, ['OK', 'ERROR', 'SSLERROR'] as const);
      const isShow = normalizeBooleanFilter(query.is_show);
      const recommend = normalizeBooleanFilter(query.recommend);
      const mainTagId = normalizeOptionalString(query.main_tag_id);
      const filters = [
        keyword
          ? or(
              ilike(Sites.name, `%${keyword}%`),
              ilike(Sites.url, `%${keyword}%`),
              ilike(Sites.bid, `%${keyword}%`),
            )
          : undefined,
        classificationStatus ? eq(Sites.classification_status, classificationStatus) : undefined,
        accessScope ? eq(Sites.access_scope, accessScope) : undefined,
        siteStatus ? eq(Sites.status, siteStatus) : undefined,
        typeof isShow === 'boolean' ? eq(Sites.is_show, isShow) : undefined,
        typeof recommend === 'boolean' ? eq(Sites.recommend, recommend) : undefined,
        mainTagId
          ? sql<boolean>`exists (
              select 1
              from ${SiteTags}
              inner join ${TagDefinitions}
                on ${SiteTags.tag_id} = ${TagDefinitions.id}
              where ${SiteTags.site_id} = ${Sites.id}
                and ${SiteTags.tag_id} = ${mainTagId}
                and ${TagDefinitions.tag_type} = 'MAIN'
            )`
          : undefined,
      ].filter(Boolean);
      const whereClause = filters.length > 0 ? and(...filters) : undefined;
      const requestedPage = toPositiveInt(query.page, 1);
      const requestedPageSize = toPositiveInt(query.pageSize, 10);
      const [countRow] = await app.db.read
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(Sites)
        .where(whereClause);
      const pagination = normalizePagination(
        requestedPage,
        requestedPageSize,
        countRow?.total ?? 0,
      );
      const rows = await app.db.read
        .select({
          id: Sites.id,
          bid: Sites.bid,
          name: Sites.name,
          url: Sites.url,
          classification_status: Sites.classification_status,
          access_scope: Sites.access_scope,
          status: Sites.status,
          is_show: Sites.is_show,
          recommend: Sites.recommend,
          update_time: Sites.update_time,
        })
        .from(Sites)
        .where(whereClause)
        .orderBy(desc(Sites.update_time))
        .limit(pagination.pageSize)
        .offset((pagination.page - 1) * pagination.pageSize);
      const siteTagRows =
        rows.length > 0
          ? await app.db.read
              .select({
                site_id: SiteTags.site_id,
                tag_id: SiteTags.tag_id,
              })
              .from(SiteTags)
              .where(
                inArray(
                  SiteTags.site_id,
                  rows.map((row) => row.id),
                ),
              )
          : [];
      const mainTagDefinitionRows =
        siteTagRows.length > 0
          ? await app.db.read
              .select({
                id: TagDefinitions.id,
                name: TagDefinitions.name,
              })
              .from(TagDefinitions)
              .where(
                and(
                  inArray(
                    TagDefinitions.id,
                    siteTagRows.map((row) => row.tag_id),
                  ),
                  eq(TagDefinitions.tag_type, 'MAIN'),
                ),
              )
          : [];
      const mainTagDefinitionById = new Map(mainTagDefinitionRows.map((row) => [row.id, row.name]));
      const mainTagBySiteId = new Map(
        siteTagRows.flatMap((row) => {
          const mainTagName = mainTagDefinitionById.get(row.tag_id);

          if (!mainTagName) {
            return [];
          }

          return [
            [
              row.site_id,
              {
                id: row.tag_id,
                name: mainTagName,
              },
            ] as const,
          ];
        }),
      );

      return {
        ok: true,
        data: {
          items: rows.map((row) => ({
            ...row,
            main_tag_id: mainTagBySiteId.get(row.id)?.id ?? null,
            main_tag_name: mainTagBySiteId.get(row.id)?.name ?? null,
            update_time: row.update_time.toISOString(),
          })),
          pagination,
        },
      };
    },
  );
}
