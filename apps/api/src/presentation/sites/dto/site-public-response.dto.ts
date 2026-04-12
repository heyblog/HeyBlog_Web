import {
  activeSubmissionResultSchema,
  architectureResultSchema,
  feedCandidateResultSchema,
  optionItemResultSchema,
  selectedFeedItemResultSchema,
  subTagSnapshotItemResultSchema,
  techStackOptionItemResultSchema,
} from './site-shared-response.dto';

const submissionResultSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        audit_id: { type: 'string' },
        action: { type: 'string' },
        status: { type: 'string' },
        site_id: { type: ['string', 'null'] },
      },
      required: ['audit_id', 'action', 'status', 'site_id'],
    },
  },
  required: ['ok', 'data'],
} as const;

const submissionQueryResultSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        audit_id: { type: 'string' },
        action: { type: 'string' },
        status: { type: 'string' },
        site_id: { type: ['string', 'null'] },
        site_name: { type: ['string', 'null'] },
        reviewer_comment: { type: ['string', 'null'] },
        created_time: { type: 'string' },
        reviewed_time: { type: ['string', 'null'] },
      },
      required: [
        'audit_id',
        'action',
        'status',
        'site_id',
        'site_name',
        'reviewer_comment',
        'created_time',
        'reviewed_time',
      ],
    },
  },
  required: ['ok', 'data'],
} as const;

const siteLookupResultSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        site_id: { type: 'string' },
        bid: { type: ['string', 'null'] },
        name: { type: 'string' },
        url: { type: 'string' },
        sign: { type: 'string' },
        feed: {
          type: 'array',
          items: selectedFeedItemResultSchema,
        },
        sitemap: { type: ['string', 'null'] },
        link_page: { type: ['string', 'null'] },
        main_tag_id: { type: ['string', 'null'] },
        sub_tags: { type: 'array', items: subTagSnapshotItemResultSchema },
        architecture: architectureResultSchema,
      },
      required: [
        'site_id',
        'bid',
        'name',
        'url',
        'sign',
        'feed',
        'sitemap',
        'link_page',
        'main_tag_id',
        'sub_tags',
        'architecture',
      ],
    },
  },
  required: ['ok', 'data'],
} as const;

const siteSearchResultSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          site_id: { type: 'string' },
          bid: { type: ['string', 'null'] },
          name: { type: 'string' },
          url: { type: 'string' },
        },
        required: ['site_id', 'bid', 'name', 'url'],
      },
    },
  },
  required: ['ok', 'data'],
} as const;

const optionsResultSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        main_tags: { type: 'array', items: optionItemResultSchema },
        sub_tags: { type: 'array', items: optionItemResultSchema },
        programs: { type: 'array', items: optionItemResultSchema },
        tech_stacks: { type: 'array', items: techStackOptionItemResultSchema },
      },
      required: ['main_tags', 'sub_tags', 'programs', 'tech_stacks'],
    },
  },
  required: ['ok', 'data'],
} as const;

const autoFillResultSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        sign: { type: 'string' },
        feed_candidates: { type: 'array', items: feedCandidateResultSchema },
        sitemap: { type: 'string' },
        link_page: { type: 'string' },
        architecture: architectureResultSchema,
        warnings: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['name', 'sign', 'feed_candidates', 'sitemap', 'link_page', 'architecture'],
    },
  },
  required: ['ok', 'data'],
} as const;

const duplicateReviewCandidateSchema = {
  type: 'object',
  properties: {
    site_id: { type: 'string' },
    bid: { type: ['string', 'null'] },
    name: { type: 'string' },
    url: { type: 'string' },
    visibility: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['site_id', 'bid', 'name', 'url', 'visibility', 'reason'],
} as const;

const duplicateReviewSchema = {
  type: 'object',
  properties: {
    strong: {
      type: 'array',
      items: duplicateReviewCandidateSchema,
    },
    weak: {
      type: 'array',
      items: duplicateReviewCandidateSchema,
    },
  },
  required: ['strong', 'weak'],
} as const;

const restoreTargetResultSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        site_id: { type: 'string' },
        bid: { type: ['string', 'null'] },
        name: { type: 'string' },
        url: { type: 'string' },
        reason: { type: ['string', 'null'] },
      },
      required: ['site_id', 'bid', 'name', 'url', 'reason'],
    },
  },
  required: ['ok', 'data'],
} as const;

const errorResponseSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        fields: {
          type: 'array',
          items: { type: 'string' },
        },
        duplicate_review: duplicateReviewSchema,
        active_submission: activeSubmissionResultSchema,
      },
      required: ['code', 'message'],
    },
  },
  required: ['ok', 'error'],
} as const;

const siteIdParamJsonSchema = {
  type: 'object',
  properties: {
    siteId: { type: 'string', format: 'uuid' },
  },
  required: ['siteId'],
} as const;

export {
  autoFillResultSchema,
  errorResponseSchema,
  optionsResultSchema,
  restoreTargetResultSchema,
  siteIdParamJsonSchema,
  siteLookupResultSchema,
  siteSearchResultSchema,
  submissionQueryResultSchema,
  submissionResultSchema,
};
