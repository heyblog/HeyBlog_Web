import type {
  SiteAuditSnapshot,
  SiteSnapshotDraft,
  SiteSubmissionOptions,
} from '@/application/management/site-management.snapshot';

export interface DiffViewItem {
  field: string;
  label: string;
  before_display: string;
  after_display: string;
}

export interface SnapshotFieldItem {
  field: string;
  label: string;
  value_display: string;
}

export interface AuditActionView {
  kind: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
  changes?: DiffViewItem[];
  before_fields?: SnapshotFieldItem[];
  effective_changes?: DiffViewItem[];
  effective_fields?: SnapshotFieldItem[];
  review_override_changes?: DiffViewItem[];
  after_fields?: SnapshotFieldItem[];
  submitted_fields?: SnapshotFieldItem[];
  site_fields?: SnapshotFieldItem[];
  reason?: string | null;
}

export interface AuditDetail {
  id: string;
  action: string;
  status: string;
  site_id: string | null;
  site_name: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  submit_reason: string | null;
  notify_by_email: boolean;
  reviewer_comment: string | null;
  editable_snapshot: SiteAuditSnapshot | null;
  action_view: AuditActionView;
  created_time: string;
  reviewed_time: string | null;
}

export interface AuditReviewActionViewProps {
  detail: AuditDetail;
  mode: 'detail' | 'process';
  canEditSnapshot: boolean;
  pending: boolean;
  correctionDraft: SiteSnapshotDraft;
  options: SiteSubmissionOptions;
}
