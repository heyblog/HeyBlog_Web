import {
  feedTypeSchema,
  siteAuditArchitectureSchema,
  siteAuditInsertSchema,
  siteAuditSnapshotSchema,
  siteAuditTagSchema,
} from '@zhblogs/db';

import { z } from 'zod';

const siteSnapshotExtrasSchema = z.object({
  main_tag_id: z.uuid().nullable().optional(),
  sub_tags: z.array(siteAuditTagSchema).nullable().optional(),
  architecture: siteAuditArchitectureSchema.nullable().optional(),
});

export const siteIdParamSchema = siteAuditInsertSchema
  .pick({ site_id: true })
  .required({ site_id: true });

export const siteSearchSchema = z.object({
  query: z.string().trim().min(1).max(128),
});

export const siteAutoFillSchema = z.object({
  url: z.string().trim().url(),
});

export const auditListQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELED']).optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'RESTORE']).optional(),
  site_id: siteIdParamSchema.shape.site_id.optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

const auditReviewCommentSchema = z.string().trim().max(2000).nullable().optional();

export const auditReviewSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    reviewer_comment: auditReviewCommentSchema,
    snapshot_override: siteAuditSnapshotSchema.nullable().optional(),
  })
  .superRefine((payload, ctx) => {
    if (
      payload.decision === 'REJECTED' &&
      (!payload.reviewer_comment || payload.reviewer_comment.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reviewer_comment'],
        message: 'reviewer_comment is required when decision is REJECTED.',
      });
    }
  });

const optionalReasonSubmissionContactSchema = z.object({
  submitter_name: z.string().trim().nullable(),
  submitter_email: z.string().trim().nullable(),
  submit_reason: z.string().trim(),
  notify_by_email: z.boolean(),
});

export const submissionContactSchema = optionalReasonSubmissionContactSchema.extend({
  submit_reason: z.string().trim().min(1),
});

export const submissionQuerySchema = z.object({
  audit_id: siteIdParamSchema.shape.site_id,
});

const publicSiteUrlSchema = z.string().trim().url();
const publicFeedInputSchema = z.object({
  name: z.string().trim(),
  url: publicSiteUrlSchema,
  type: feedTypeSchema.optional(),
  isDefault: z.boolean(),
});

const duplicateReviewSchema = z.object({
  confirmed_site_ids: z.array(z.uuid()).max(6),
});

export const createSiteSubmissionSchema = optionalReasonSubmissionContactSchema.extend({
  duplicate_review: duplicateReviewSchema.optional(),
  site: z.object({
    name: z.string().trim().min(1),
    url: publicSiteUrlSchema,
    sign: z.string().trim().min(1),
    icon_base64: z.string().nullable().optional(),
    feed: z.array(publicFeedInputSchema).optional(),
    sitemap: publicSiteUrlSchema.nullable().optional(),
    link_page: publicSiteUrlSchema.nullable().optional(),
    main_tag_id: siteSnapshotExtrasSchema.shape.main_tag_id,
    sub_tags: siteSnapshotExtrasSchema.shape.sub_tags,
    architecture: siteSnapshotExtrasSchema.shape.architecture,
  }),
});

export const restoreSiteSubmissionSchema = z.object({
  site_id: z.uuid(),
  submitter_name: z.string().trim().nullable(),
  submitter_email: z.string().trim().nullable(),
  restore_reason: z.string().trim().min(1),
  notify_by_email: z.boolean(),
});

export const updateSiteSubmissionSchema = optionalReasonSubmissionContactSchema
  .extend({
    changes: z.object({
      name: z.string().trim().min(1).optional(),
      url: publicSiteUrlSchema.optional(),
      sign: z.string().trim().min(1).nullable().optional(),
      icon_base64: z.string().nullable().optional(),
      feed: z.array(publicFeedInputSchema).optional(),
      sitemap: publicSiteUrlSchema.nullable().optional(),
      link_page: publicSiteUrlSchema.nullable().optional(),
      main_tag_id: siteSnapshotExtrasSchema.shape.main_tag_id.optional(),
      sub_tags: siteSnapshotExtrasSchema.shape.sub_tags.optional(),
      architecture: siteSnapshotExtrasSchema.shape.architecture.optional(),
    }),
  })
  .refine((payload) => Object.values(payload.changes).some((value) => value !== undefined), {
    message: 'At least one editable field must be provided',
    path: ['changes'],
  });

export const siteLookupSchema = z
  .object({
    bid: z.string().trim().max(64).nullable().optional(),
    url: publicSiteUrlSchema.optional(),
    site_id: siteIdParamSchema.shape.site_id.optional(),
  })
  .refine(
    (payload) =>
      [payload.site_id, payload.bid, payload.url].filter(
        (value) => value !== undefined && value !== null && String(value).trim().length > 0,
      ).length === 1,
    {
      message: 'Exactly one site lookup field must be provided',
      path: ['site_lookup'],
    },
  );

export type SiteLookupInput = {
  site_id?: string;
  bid?: string | null;
  url?: string;
};

export type SiteSearchInput = z.infer<typeof siteSearchSchema>;
export type SiteAutoFillInput = z.infer<typeof siteAutoFillSchema>;
export type AuditListQueryInput = z.infer<typeof auditListQuerySchema>;
export type AuditReviewInput = z.infer<typeof auditReviewSchema>;
export type RestoreSiteSubmissionInput = z.infer<typeof restoreSiteSubmissionSchema>;
