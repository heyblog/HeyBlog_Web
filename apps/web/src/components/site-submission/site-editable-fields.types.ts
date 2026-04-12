import type { FeedType, SubTagInput } from '@/application/site-submission/site-submission.service';

export type CommonFeedDraft = {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
  type?: FeedType;
};

export type CommonSiteForm = {
  name: string;
  url: string;
  sign: string;
  main_tag_id: string;
  sub_tags: SubTagInput[];
  feeds: CommonFeedDraft[];
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
};

export type FeedTypeOption = {
  value: FeedType;
  label: string;
};
