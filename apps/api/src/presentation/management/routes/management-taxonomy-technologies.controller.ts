import { TechnologyCatalogs } from '@zhblogs/db';

import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  normalizeOptionalString,
  requireManagementPermission,
  sendManagementError,
} from './management-route.shared';

export function registerManagementTaxonomyTechnologyRoutes(app: FastifyInstance): void {
  app.post(
    '/api/management/taxonomy/technologies',
    {
      preHandler: requireManagementPermission('taxonomy.manage'),
    },
    async (request, reply) => {
      const body = request.body as {
        id?: string;
        name?: string;
        technology_type?: 'FRAMEWORK' | 'LANGUAGE';
        description?: string | null;
        official_url?: string | null;
        is_enabled?: boolean;
      };

      if (!body.name?.trim() || !body.technology_type) {
        return sendManagementError(
          reply,
          400,
          'INVALID_BODY',
          'name and technology_type are required.',
        );
      }

      if (body.technology_type !== 'FRAMEWORK' && body.technology_type !== 'LANGUAGE') {
        return sendManagementError(
          reply,
          400,
          'INVALID_BODY',
          'technology_type must be FRAMEWORK or LANGUAGE.',
        );
      }

      const values = {
        name: body.name.trim(),
        name_normalized: body.name.trim().toLowerCase(),
        technology_type: body.technology_type,
        description: normalizeOptionalString(body.description),
        official_url: normalizeOptionalString(body.official_url),
        is_enabled: body.is_enabled ?? true,
      };

      const rows = body.id
        ? await app.db.write
            .update(TechnologyCatalogs)
            .set(values)
            .where(eq(TechnologyCatalogs.id, body.id))
            .returning()
        : await app.db.write.insert(TechnologyCatalogs).values(values).returning();
      const row = Array.isArray(rows) ? (rows[0] ?? null) : null;

      return {
        ok: true,
        data: row,
      };
    },
  );
}
