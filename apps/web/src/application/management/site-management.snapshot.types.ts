export type FeedTypeKey = 'RSS' | 'ATOM' | 'JSON';

export interface SiteFeedSnapshot {
  name?: string | null;
  url?: string | null;
  type?: FeedTypeKey;
  isDefault?: boolean | null;
}

export interface SiteArchitectureStackSnapshot {
  category?: 'FRAMEWORK' | 'LANGUAGE' | null;
  catalog_id?: string | null;
  name?: string | null;
  name_normalized?: string | null;
}

export interface SiteArchitectureSnapshot {
  program_id?: string | null;
  program_name?: string | null;
  program_is_open_source?: boolean | null;
  stacks?: SiteArchitectureStackSnapshot[] | null;
  website_url?: string | null;
  repo_url?: string | null;
}

export interface SiteSubTagSnapshot {
  tag_id?: string | null;
  name?: string | null;
  name_normalized?: string | null;
}

export interface SiteMainTagSnapshot {
  tag_id?: string | null;
  name?: string | null;
  name_normalized?: string | null;
}

export interface SiteAuditSnapshot {
  bid?: string | null;
  name?: string | null;
  url?: string | null;
  sign?: string | null;
  icon_base64?: string | null;
  feed?: SiteFeedSnapshot[] | null;
  from?: string[] | null;
  classification_status?: string | null;
  sitemap?: string | null;
  link_page?: string | null;
  access_scope?: 'CN_ONLY' | 'GLOBAL_ONLY' | 'BOTH' | null;
  status?: 'OK' | 'ERROR' | 'SSLERROR' | null;
  is_show?: boolean | null;
  recommend?: boolean | null;
  reason?: string | null;
  main_tag?: SiteMainTagSnapshot | null;
  sub_tags?: SiteSubTagSnapshot[] | null;
  architecture?: SiteArchitectureSnapshot | null;
}

export interface SiteSubmissionOptionItem {
  id: string;
  name: string;
  category?: 'FRAMEWORK' | 'LANGUAGE';
}

export interface SiteSubmissionOptions {
  main_tags: SiteSubmissionOptionItem[];
  sub_tags: SiteSubmissionOptionItem[];
  programs: SiteSubmissionOptionItem[];
  tech_stacks: SiteSubmissionOptionItem[];
}

export interface SiteFeedDraft {
  id: string;
  name: string;
  url: string;
  type: FeedTypeKey;
  isDefault: boolean;
}

export interface SiteSnapshotDraft {
  bid: string;
  name: string;
  url: string;
  sign: string;
  icon_base64: string;
  classification_status: 'COMPLETE' | 'NEEDS_REVIEW';
  sitemap: string;
  link_page: string;
  reason: string;
  is_show: boolean;
  recommend: boolean;
  access_scope: 'CN_ONLY' | 'GLOBAL_ONLY' | 'BOTH';
  status: 'OK' | 'ERROR' | 'SSLERROR';
  from: string[];
  main_tag_id: string;
  sub_tags: SiteSubTagSnapshot[];
  feeds: SiteFeedDraft[];
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
