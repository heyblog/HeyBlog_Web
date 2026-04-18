import { type MultiFeed, SiteAudits, type SiteAuditSnapshot } from '@zhblogs/db';

import type { FastifyInstance } from 'fastify';

import { normalizeManagementSiteSnapshot } from '@/domain/sites/service/site-management-snapshot.service';
import { buildSnapshotDiff } from '@/domain/sites/service/site-snapshot.service';
import { loadCurrentSiteSnapshot } from '@/infrastructure/sites/db/site.repository';

type SiteCorrectionInput = {
  site_id: string;
  url?: string | null;
  feed?: MultiFeed[] | null;
  sitemap?: string | null;
  link_page?: string | null;
  submit_reason?: string | null;
};

export async function createSystemSiteCorrectionAudit(
  app: FastifyInstance,
  input: SiteCorrectionInput,
) {
  const currentSnapshot = await loadCurrentSiteSnapshot(app, input.site_id);
  if (!currentSnapshot) {
    throw new Error('SITE_NOT_FOUND');
  }

  const proposedSnapshot = normalizeManagementSiteSnapshot({
    ...currentSnapshot,
    ...(input.url !== undefined ? { url: input.url ?? '' } : {}),
    ...(input.feed !== undefined ? { feed: input.feed } : {}),
    ...(input.sitemap !== undefined ? { sitemap: input.sitemap } : {}),
    ...(input.link_page !== undefined ? { link_page: input.link_page } : {}),
  } as SiteAuditSnapshot);
  const diff = buildSnapshotDiff(currentSnapshot, proposedSnapshot);

  if (diff.length === 0) {
    return {
      site_id: input.site_id,
      applied: false,
      audit_id: null,
      status: null,
    };
  }

  const [createdAudit] = await app.db.write
    .insert(SiteAudits)
    .values({
      site_id: input.site_id,
      action: 'UPDATE',
      current_snapshot: currentSnapshot,
      proposed_snapshot: proposedSnapshot,
      diff,
      submit_reason: input.submit_reason ?? 'SYSTEM_CONTENT_VALIDATION_CORRECTION',
      submitter_name: '系统',
      submitter_email: null,
      notify_by_email: false,
    })
    .returning({
      id: SiteAudits.id,
      status: SiteAudits.status,
    });

  if (!createdAudit) {
    throw new Error('AUDIT_INSERT_FAILED');
  }

  return {
    site_id: input.site_id,
    applied: true,
    audit_id: createdAudit.id,
    status: createdAudit.status,
  };
}
