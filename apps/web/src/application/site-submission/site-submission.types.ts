export type FeedType = 'RSS' | 'ATOM' | 'JSON';
export type SubmissionPage = 'create' | 'update' | 'delete' | 'query';

export interface FeedInput {
  name: string;
  url: string;
  type?: FeedType;
  isDefault: boolean;
}

export interface FeedDraft {
  id: string;
  name: string;
  url: string;
  type: FeedType;
  isDefault: boolean;
}

export const FEED_TYPE_OPTIONS: Array<{ value: FeedType; label: string }> = [
  { value: 'RSS', label: 'RSS' },
  { value: 'ATOM', label: 'Atom' },
  { value: 'JSON', label: 'JSON Feed' },
];

export interface FeedCandidateInput {
  name: string;
  url: string;
}

export interface ArchitectureInput {
  program_id?: string | null;
  program_name?: string | null;
  program_is_open_source?: boolean | null;
  stacks?: Array<{
    category: 'FRAMEWORK' | 'LANGUAGE';
    catalog_id?: string | null;
    name?: string | null;
    name_normalized?: string | null;
  }> | null;
  website_url?: string | null;
  repo_url?: string | null;
}

export interface SubTagInput {
  tag_id?: string | null;
  name?: string | null;
  name_normalized?: string | null;
}

export interface SiteSubmissionOptionItem {
  id: string;
  name: string;
  category?: 'FRAMEWORK' | 'LANGUAGE';
}

export interface SiteSubmissionOptionsResult {
  main_tags: SiteSubmissionOptionItem[];
  sub_tags: SiteSubmissionOptionItem[];
  programs: SiteSubmissionOptionItem[];
  tech_stacks: SiteSubmissionOptionItem[];
}

export interface SiteResolveRequest {
  site_id?: string;
  bid?: string;
  url?: string;
}

export interface SiteResolveResult {
  site_id: string;
  bid: string | null;
  name: string;
  url: string;
  sign: string;
  feed: FeedInput[];
  sitemap: string | null;
  link_page: string | null;
  main_tag_id: string | null;
  sub_tags: SubTagInput[];
  architecture: ArchitectureInput | null;
}

export interface SiteSearchItem {
  site_id: string;
  bid: string | null;
  name: string;
  url: string;
}

export interface SiteAutoFillResult {
  name: string;
  sign: string;
  feed_candidates: FeedCandidateInput[];
  sitemap: string;
  link_page: string;
  architecture: ArchitectureInput | null;
  warnings?: string[];
}

interface SubmissionContact {
  submitter_name: string | null;
  submitter_email: string | null;
  submit_reason: string;
  notify_by_email: boolean;
}

export interface SiteSubmissionCreateRequest extends SubmissionContact {
  duplicate_review?: {
    confirmed_site_ids: string[];
  };
  site: {
    name: string;
    url: string;
    sign: string;
    feed?: FeedInput[];
    sitemap?: string | null;
    link_page?: string | null;
    main_tag_id: string;
    sub_tags?: SubTagInput[];
    architecture?: ArchitectureInput | null;
  };
}

export interface SiteSubmissionUpdateRequest extends SubmissionContact {
  site_identifier: string;
  changes: {
    name?: string;
    url?: string;
    sign?: string | null;
    feed?: FeedInput[];
    sitemap?: string | null;
    link_page?: string | null;
    main_tag_id?: string | null;
    sub_tags?: SubTagInput[] | null;
    architecture?: ArchitectureInput | null;
  };
}

export interface SiteSubmissionDeleteRequest extends SubmissionContact {
  site_identifier: string;
}

export interface SiteSubmissionRestoreRequest {
  site_id: string;
  submitter_name: string | null;
  submitter_email: string | null;
  restore_reason: string;
  notify_by_email: boolean;
}

export interface SiteSubmissionQueryRequest {
  audit_id: string;
}

export interface SubmissionResult {
  audit_id: string;
  action: string;
  status: string;
  site_id: string | null;
}

export interface SubmissionStatusResult extends SubmissionResult {
  site_name: string | null;
  reviewer_comment: string | null;
  created_time: string;
  reviewed_time: string | null;
}

export interface SubmissionDuplicateCandidate {
  site_id: string;
  bid: string | null;
  name: string;
  url: string;
  visibility: 'VISIBLE' | 'HIDDEN';
  reason: string;
}

export interface SubmissionDuplicateReviewPayload {
  strong: SubmissionDuplicateCandidate[];
  weak: SubmissionDuplicateCandidate[];
}

export interface RestoreTargetResult {
  site_id: string;
  bid: string | null;
  name: string;
  url: string;
  reason: string | null;
}

export interface ApiErrorPayload {
  ok: false;
  error: {
    code: string;
    message: string;
    fields?: string[];
    duplicate_review?: SubmissionDuplicateReviewPayload;
  };
}

export interface ApiSuccessPayload<T> {
  ok: true;
  data: T;
}

export type ApiPayload<T> = ApiSuccessPayload<T> | ApiErrorPayload;

interface ContactFormState {
  submitter_name: string;
  submitter_email: string;
  submit_reason: string;
  notify_by_email: boolean;
  agree_terms: boolean;
}

interface SiteFormState {
  name: string;
  url: string;
  sign: string;
  main_tag_id: string;
  sub_tags: SubTagInput[];
  feeds: FeedDraft[];
  sitemap: string;
  link_page: string;
  architecture_program_id: string;
  architecture_program_name: string;
  architecture_program_is_open_source: boolean | null;
  architecture_framework_ids: string[];
  architecture_framework_custom_names: string[];
  architecture_language_ids: string[];
  architecture_language_custom_names: string[];
  architecture_website_url: string;
  architecture_repo_url: string;
}

export interface CreateSubmissionFormState extends ContactFormState, SiteFormState {}

export interface UpdateSubmissionFormState extends ContactFormState, SiteFormState {
  site_identifier: string;
}

export interface DeleteSubmissionFormState extends ContactFormState {
  site_identifier: string;
}

export interface QuerySubmissionFormState {
  audit_id: string;
}

export interface RestoreSubmissionFormState {
  submitter_name: string;
  submitter_email: string;
  restore_reason: string;
  notify_by_email: boolean;
  agree_terms: boolean;
}

export type FieldErrors = Record<string, string>;

export const AUDIT_STATUS_META: Record<
  string,
  { label: string; tone: 'pending' | 'ok' | 'warn' | 'muted' }
> = {
  PENDING: { label: '待审核', tone: 'pending' },
  APPROVED: { label: '已通过', tone: 'ok' },
  REJECTED: { label: '已驳回', tone: 'warn' },
  CANCELED: { label: '已取消', tone: 'muted' },
};

export const ACTION_LABELS: Record<string, string> = {
  CREATE: '新增站点',
  UPDATE: '修订资料',
  DELETE: '删除站点',
  RESTORE: '恢复站点',
};
