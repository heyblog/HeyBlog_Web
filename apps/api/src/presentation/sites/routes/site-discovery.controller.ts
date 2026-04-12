import type { SiteAuditSnapshot } from '@zhblogs/db';

import type { FastifyInstance, FastifyReply } from 'fastify';

import type { SiteAutoFillHints } from '@/domain/sites/types/site-auto-fill.types';

import type { SiteLookupInput } from '../dto/site-request.dto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParseResult = { success: true; data: any } | { success: false };

type SafeParser = {
  safeParse: (input: unknown) => ParseResult;
};

type ErrorResponder = (
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  fields?: string[],
) => unknown;

type SiteLookupTarget = {
  site_id: string;
  name: string;
  url: string;
};

type SiteSnapshot = SiteAuditSnapshot;

type DiscoveryRouteDeps = {
  errorResponseSchema: unknown;
  siteSearchSchema: SafeParser;
  siteSearchResultSchema: unknown;
  loadSiteSearchResults: (app: FastifyInstance, query: string) => Promise<unknown>;
  optionsResultSchema: unknown;
  loadSubmissionOptions: (app: FastifyInstance) => Promise<unknown>;
  siteAutoFillSchema: SafeParser;
  autoFillResultSchema: unknown;
  loadAutoFillHints: (app: FastifyInstance) => Promise<SiteAutoFillHints>;
  autoFillSite: (url: string, hints: SiteAutoFillHints) => Promise<unknown>;
  siteLookupSchema: SafeParser;
  siteLookupResultSchema: unknown;
  validateSiteLookupFields: (payload: SiteLookupInput) => string[];
  loadSiteLookupTarget: (
    app: FastifyInstance,
    payload: SiteLookupInput,
  ) => Promise<SiteLookupTarget | null>;
  loadCurrentSiteSnapshot: (app: FastifyInstance, siteId: string) => Promise<SiteSnapshot | null>;
  sendApiError: ErrorResponder;
};

export function registerSiteDiscoveryRoutes(app: FastifyInstance, deps: DiscoveryRouteDeps): void {
  app.post(
    '/api/sites/search',
    {
      schema: {
        tags: ['sites'],
        summary: 'Search public sites for update or deletion requests',
        response: {
          200: deps.siteSearchResultSchema,
          400: deps.errorResponseSchema,
        },
      },
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = deps.siteSearchSchema.safeParse(request.body);

      if (!parsed.success) {
        return deps.sendApiError(
          reply,
          400,
          'INVALID_BODY',
          'Request body is invalid for site search.',
        );
      }

      return {
        ok: true,
        data: await deps.loadSiteSearchResults(app, parsed.data.query),
      };
    },
  );

  app.get(
    '/api/sites/submission-options',
    {
      schema: {
        tags: ['sites'],
        summary: 'Load public submission option lists',
        response: {
          200: deps.optionsResultSchema,
          503: deps.errorResponseSchema,
        },
      },
      config: {
        rateLimit: {
          max: 120,
          timeWindow: '1 minute',
        },
      },
    },
    async (_request, reply) => {
      try {
        return {
          ok: true,
          data: await deps.loadSubmissionOptions(app),
        };
      } catch (error) {
        app.log.error({ error }, 'failed to load submission options');
        return deps.sendApiError(
          reply,
          503,
          'DEPENDENCY_ERROR',
          'Unable to load the submission options right now.',
        );
      }
    },
  );

  app.post(
    '/api/sites/auto-fill',
    {
      schema: {
        tags: ['sites'],
        summary: 'Auto-fill site submission fields from a public URL',
        response: {
          200: deps.autoFillResultSchema,
          400: deps.errorResponseSchema,
          502: deps.errorResponseSchema,
        },
      },
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = deps.siteAutoFillSchema.safeParse(request.body);

      if (!parsed.success) {
        return deps.sendApiError(
          reply,
          400,
          'INVALID_BODY',
          'Request body is invalid for site auto-fill.',
        );
      }

      try {
        const hints = await deps.loadAutoFillHints(app);

        return {
          ok: true,
          data: await deps.autoFillSite(parsed.data.url, hints),
        };
      } catch (error) {
        app.log.warn({ error, url: parsed.data.url }, 'site auto-fill failed');
        return deps.sendApiError(
          reply,
          502,
          'AUTO_FILL_FAILED',
          'Unable to fetch the target site for auto-fill right now.',
        );
      }
    },
  );

  app.post(
    '/api/sites/resolve',
    {
      schema: {
        tags: ['sites'],
        summary: 'Resolve a public site submission target by ID, bid, or URL',
        response: {
          200: deps.siteLookupResultSchema,
          400: deps.errorResponseSchema,
          404: deps.errorResponseSchema,
        },
      },
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = deps.siteLookupSchema.safeParse(request.body);

      if (!parsed.success) {
        return deps.sendApiError(
          reply,
          400,
          'INVALID_BODY',
          'Request body is invalid for a site lookup.',
        );
      }

      const payload = parsed.data;
      const invalidFields = deps.validateSiteLookupFields(payload);

      if (invalidFields.length > 0) {
        return deps.sendApiError(
          reply,
          400,
          'INVALID_BODY',
          'Request body contains empty or malformed fields.',
          invalidFields,
        );
      }

      const site = await deps.loadSiteLookupTarget(app, payload);

      if (!site) {
        return deps.sendApiError(reply, 404, 'SITE_NOT_FOUND', 'The target site does not exist.');
      }

      const snapshot = await deps.loadCurrentSiteSnapshot(app, site.site_id);

      if (!snapshot) {
        return deps.sendApiError(reply, 404, 'SITE_NOT_FOUND', 'The target site does not exist.');
      }

      return {
        ok: true,
        data: {
          ...site,
          sign: snapshot.sign ?? '',
          feed: snapshot.feed ?? [],
          sitemap: snapshot.sitemap ?? null,
          link_page: snapshot.link_page ?? null,
          main_tag_id: snapshot.main_tag?.tag_id ?? null,
          sub_tags: snapshot.sub_tags ?? [],
          architecture: snapshot.architecture ?? null,
        },
      };
    },
  );
}
