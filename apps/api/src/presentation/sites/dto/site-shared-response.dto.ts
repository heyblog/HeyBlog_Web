const createObjectSchema = <
  TProperties extends Record<string, unknown>,
  TRequired extends readonly string[],
>(
  properties: TProperties,
  required: TRequired,
) =>
  ({
    type: 'object',
    properties,
    required,
  }) as const;

const feedCandidateResultSchema = createObjectSchema(
  {
    name: { type: 'string' },
    url: { type: 'string' },
    type: { type: 'string' },
  },
  ['name', 'url'] as const,
);

const selectedFeedItemResultSchema = createObjectSchema(
  {
    name: { type: 'string' },
    url: { type: 'string' },
    type: { type: 'string' },
    isDefault: { type: 'boolean' },
  },
  ['name', 'url', 'isDefault'] as const,
);

const optionItemResultSchema = createObjectSchema(
  {
    id: { type: 'string' },
    name: { type: 'string' },
  },
  ['id', 'name'] as const,
);

const subTagSnapshotItemResultSchema = createObjectSchema(
  {
    tag_id: { type: ['string', 'null'] },
    name: { type: ['string', 'null'] },
    name_normalized: { type: ['string', 'null'] },
  },
  ['tag_id', 'name', 'name_normalized'] as const,
);

const techStackOptionItemResultSchema = createObjectSchema(
  {
    id: { type: 'string' },
    name: { type: 'string' },
    category: { type: 'string', enum: ['FRAMEWORK', 'LANGUAGE'] },
  },
  ['id', 'name', 'category'] as const,
);

const architectureResultSchema = {
  type: ['object', 'null'],
  properties: {
    program_id: { type: ['string', 'null'] },
    program_name: { type: ['string', 'null'] },
    program_is_open_source: { type: ['boolean', 'null'] },
    stacks: {
      type: ['array', 'null'],
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['FRAMEWORK', 'LANGUAGE'] },
          catalog_id: { type: ['string', 'null'] },
          name: { type: ['string', 'null'] },
          name_normalized: { type: ['string', 'null'] },
        },
        required: ['category', 'catalog_id', 'name', 'name_normalized'],
      },
    },
    website_url: { type: ['string', 'null'] },
    repo_url: { type: ['string', 'null'] },
  },
  required: [
    'program_id',
    'program_name',
    'program_is_open_source',
    'stacks',
    'website_url',
    'repo_url',
  ],
} as const;

const activeSubmissionResultSchema = createObjectSchema(
  {
    audit_id: { type: 'string' },
    action: { type: 'string' },
    status: { type: 'string' },
    created_time: { type: 'string' },
    site_id: { type: ['string', 'null'] },
  },
  ['audit_id', 'action', 'status', 'created_time', 'site_id'] as const,
);

export {
  activeSubmissionResultSchema,
  architectureResultSchema,
  feedCandidateResultSchema,
  optionItemResultSchema,
  selectedFeedItemResultSchema,
  subTagSnapshotItemResultSchema,
  techStackOptionItemResultSchema,
};
