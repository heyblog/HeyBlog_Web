import {
  createEmptyFeedDraft,
  type CreateSubmissionFormState,
  ensureSingleDefaultFeedDrafts,
  type FeedType,
  trimText,
  type UpdateSubmissionFormState,
} from './site-submission.service';

type SiteFormState = CreateSubmissionFormState | UpdateSubmissionFormState;

export interface CustomProgramDraft {
  name: string;
  isOpenSource: boolean | null;
  websiteUrl: string;
  repoUrl: string;
  frameworkIds: string[];
  frameworkCustomNames: string[];
  languageIds: string[];
  languageCustomNames: string[];
}

function normalizeUniqueList(values: string[]): string[] {
  return [...new Set(values.map((value) => trimText(value)).filter(Boolean))];
}

export function applyAddressInferenceToForm(form: SiteFormState, url: string): void {
  if (form.feeds[0]) {
    form.feeds[0].url = url;
  }

  form.feeds = ensureSingleDefaultFeedDrafts(form.feeds);
  form.sitemap = url;
  form.link_page = url;
}

export function applyProgramOptionToForm(form: SiteFormState, optionId: string): void {
  form.architecture_program_id = optionId;
  form.architecture_program_name = '';
  form.architecture_program_is_open_source = null;
  form.architecture_website_url = '';
  form.architecture_repo_url = '';
  form.architecture_framework_ids = [];
  form.architecture_framework_custom_names = [];
  form.architecture_language_ids = [];
  form.architecture_language_custom_names = [];
}

export function applyProgramCustomToForm(form: SiteFormState, query: string): void {
  form.architecture_program_id = '';
  form.architecture_program_name = trimText(query);
}

export function applyProgramCustomDraftToForm(
  form: SiteFormState,
  draft: CustomProgramDraft,
): void {
  form.architecture_program_id = '';
  form.architecture_program_name = trimText(draft.name);
  form.architecture_program_is_open_source =
    typeof draft.isOpenSource === 'boolean' ? draft.isOpenSource : null;
  form.architecture_website_url = trimText(draft.websiteUrl);
  form.architecture_repo_url = trimText(draft.repoUrl);
  form.architecture_framework_ids = normalizeUniqueList(draft.frameworkIds);
  form.architecture_framework_custom_names = normalizeUniqueList(draft.frameworkCustomNames);
  form.architecture_language_ids = normalizeUniqueList(draft.languageIds);
  form.architecture_language_custom_names = normalizeUniqueList(draft.languageCustomNames);
}

export function addFeedToForm(form: SiteFormState): void {
  const draft = createEmptyFeedDraft();
  form.feeds = ensureSingleDefaultFeedDrafts([...form.feeds, draft]);
}

export function removeFeedFromForm(form: SiteFormState, id: string): void {
  const fallbackId =
    form.feeds.find((feed) => feed.isDefault && feed.id !== id)?.id ??
    form.feeds.find((feed) => feed.id !== id)?.id ??
    null;

  form.feeds = ensureSingleDefaultFeedDrafts(
    form.feeds.filter((feed) => feed.id !== id),
    fallbackId,
  );
}

export function updateFeedNameInForm(form: SiteFormState, id: string, value: string): void {
  form.feeds = form.feeds.map((feed) => (feed.id === id ? { ...feed, name: value } : feed));
}

export function updateFeedUrlInForm(form: SiteFormState, id: string, value: string): boolean {
  const current = form.feeds.find((feed) => feed.id === id);
  form.feeds = ensureSingleDefaultFeedDrafts(
    form.feeds.map((feed) => (feed.id === id ? { ...feed, url: value } : feed)),
    current?.isDefault ? id : undefined,
  );

  if (!current) {
    return false;
  }

  return true;
}

export function updateFeedTypeInForm(form: SiteFormState, id: string, value: FeedType): void {
  form.feeds = form.feeds.map((feed) => (feed.id === id ? { ...feed, type: value } : feed));
}

export function selectDefaultFeedInForm(form: SiteFormState, id: string): void {
  form.feeds = ensureSingleDefaultFeedDrafts(form.feeds, trimText(id));
}

export function buildUrlUpdatedForm<T extends SiteFormState>(form: T, value: string): T {
  return {
    ...form,
    feeds: [...form.feeds],
    url: value,
  };
}
