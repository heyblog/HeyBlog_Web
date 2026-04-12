const auditListResultSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              action: { type: 'string' },
              status: { type: 'string' },
              site_id: { type: ['string', 'null'] },
              site_name: { type: ['string', 'null'] },
              submitter_name: { type: ['string', 'null'] },
              submitter_email: { type: ['string', 'null'] },
              submit_reason: { type: ['string', 'null'] },
              created_time: { type: 'string' },
              reviewed_time: { type: ['string', 'null'] },
            },
            required: [
              'id',
              'action',
              'status',
              'site_id',
              'site_name',
              'submitter_name',
              'submitter_email',
              'submit_reason',
              'created_time',
              'reviewed_time',
            ],
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            pageSize: { type: 'number' },
            totalItems: { type: 'number' },
            totalPages: { type: 'number' },
          },
          required: ['page', 'pageSize', 'totalItems', 'totalPages'],
        },
      },
      required: ['items', 'pagination'],
    },
  },
  required: ['ok', 'data'],
} as const;

const auditDetailResultSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['ok', 'data'],
} as const;

const auditIdParamJsonSchema = {
  type: 'object',
  properties: {
    auditId: { type: 'string', format: 'uuid' },
  },
  required: ['auditId'],
} as const;

export { auditDetailResultSchema, auditIdParamJsonSchema, auditListResultSchema };
