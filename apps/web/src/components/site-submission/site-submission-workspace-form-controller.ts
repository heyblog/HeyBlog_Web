import {
  addFeedToForm,
  applyAddressInferenceToForm,
  applyProgramCustomDraftToForm,
  applyProgramCustomToForm,
  applyProgramOptionToForm,
  buildUrlUpdatedForm,
  type CustomProgramDraft,
  removeFeedFromForm,
  selectDefaultFeedInForm,
  updateFeedNameInForm,
  updateFeedTypeInForm,
  updateFeedUrlInForm,
} from '@/application/site-submission/site-submission.browser-form';
import {
  type AutoFillFieldKey,
  type AutoFillMissingState,
  isSameAsSiteUrl,
  syncUrlSuggestions,
  withInputStateClass as buildInputStateClass,
} from '@/application/site-submission/site-submission.browser-workspace';
import {
  type CreateSubmissionFormState,
  isHttpUrl,
  trimText,
  type UpdateSubmissionFormState,
} from '@/application/site-submission/site-submission.service';
import { openSubmissionToast } from '@/shared/browser/submission-toast.service';

import { WORKSPACE_WARNED_INPUT_CLASS } from './site-submission-workspace.constants';
import type {
  SiteFormKind,
  SiteSubmissionWorkspaceControllerContext,
} from './site-submission-workspace.types';

export function createSiteSubmissionWorkspaceFormController(
  context: SiteSubmissionWorkspaceControllerContext,
) {
  const getSiteFormState = (kind: SiteFormKind) =>
    kind === 'create' ? context.forms.create : context.forms.update;
  const getAutoFillMissingState = (kind: SiteFormKind) =>
    kind === 'create' ? context.autoFillMissing.create : context.autoFillMissing.update;
  const getProgramPickerState = (kind: SiteFormKind) =>
    kind === 'create' ? context.programPicker.create : context.programPicker.update;
  const getFormErrorState = (kind: SiteFormKind) =>
    kind === 'create' ? context.errors.create : context.errors.update;

  const setAutoFillMissing = (kind: SiteFormKind, next: AutoFillMissingState): void => {
    getAutoFillMissingState(kind).set(next);
  };

  const getAutoFillMissing = (kind: SiteFormKind): AutoFillMissingState =>
    getAutoFillMissingState(kind).get();

  const setProgramPickerValue = (kind: SiteFormKind, value: string): void => {
    getProgramPickerState(kind).set(value);
  };

  const mutateSiteForm = (
    kind: SiteFormKind,
    mutator: (form: CreateSubmissionFormState | UpdateSubmissionFormState) => void,
  ): void => {
    if (kind === 'create') {
      const formState = context.forms.create;
      const current = formState.get();
      const next: CreateSubmissionFormState = { ...current, feeds: [...current.feeds] };

      mutator(next);
      formState.set(next);
      return;
    }

    const formState = context.forms.update;
    const current = formState.get();
    const next: UpdateSubmissionFormState = { ...current, feeds: [...current.feeds] };

    mutator(next);
    formState.set(next);
  };

  const getSiteUrlByKind = (kind: SiteFormKind): string =>
    trimText(getSiteFormState(kind).get().url);

  const setAutoFillUrlError = (kind: SiteFormKind): void => {
    const errorState = getFormErrorState(kind);
    errorState.set({
      ...errorState.get(),
      url: '请先填写合法的站点地址。',
    });
  };

  const clearAutoFillMissing = (kind: SiteFormKind, field: AutoFillFieldKey): void => {
    const current = getAutoFillMissing(kind);

    if (!current[field]) {
      return;
    }

    setAutoFillMissing(kind, { ...current, [field]: false });
  };

  const updateSiteUrl = (kind: SiteFormKind, value: string): void => {
    if (kind === 'create') {
      const formState = context.forms.create;
      const previous = formState.get().url;
      const next = buildUrlUpdatedForm(formState.get(), value);

      syncUrlSuggestions(next, previous, value);
      formState.set(next);
      return;
    }

    const formState = context.forms.update;
    const previous = formState.get().url;
    const next = buildUrlUpdatedForm(formState.get(), value);

    syncUrlSuggestions(next, previous, value);
    formState.set(next);
  };

  const hasCustomProgramSelected = (kind: SiteFormKind): boolean => {
    const form = getSiteFormState(kind).get();

    return (
      Boolean(trimText(form.architecture_program_name)) && !trimText(form.architecture_program_id)
    );
  };

  return {
    withInputStateClass(baseClass: string, warned: boolean, missing: boolean): string {
      return buildInputStateClass(
        baseClass,
        warned,
        missing,
        'autofill-missing',
        WORKSPACE_WARNED_INPUT_CLASS,
      );
    },
    clearAutoFillMissing,
    isAutoFillMissing(kind: SiteFormKind, field: AutoFillFieldKey): boolean {
      return getAutoFillMissing(kind)[field];
    },
    fieldNeedsRefinement(kind: SiteFormKind, value: string): boolean {
      return Boolean(trimText(value)) && isSameAsSiteUrl(getSiteUrlByKind(kind), value);
    },
    updateCreateUrl(value: string): void {
      updateSiteUrl('create', value);
    },
    updateUpdateUrl(value: string): void {
      updateSiteUrl('update', value);
    },
    getProgramPickerSelected(kind: SiteFormKind): string {
      if (hasCustomProgramSelected(kind)) {
        return '';
      }

      const pickerValue = getProgramPickerState(kind).get();
      return pickerValue || getSiteFormState(kind).get().architecture_program_id;
    },
    applyAddressInference(kind: SiteFormKind): void {
      const url = getSiteUrlByKind(kind);

      if (!isHttpUrl(url)) {
        setAutoFillUrlError(kind);
        return;
      }

      mutateSiteForm(kind, (form) => {
        applyAddressInferenceToForm(form, url);
      });

      openSubmissionToast({
        tone: 'info',
        title: '已刷新地址推断',
        message: '已同步基础地址，请补路径或清空。',
      });
    },
    selectProgramOption(kind: SiteFormKind, optionId: string): void {
      if (!optionId) {
        return;
      }

      setProgramPickerValue(kind, optionId);
      mutateSiteForm(kind, (form) => {
        applyProgramOptionToForm(form, optionId);
      });
      clearAutoFillMissing(kind, 'architecture');
    },
    requestProgramCustom(kind: SiteFormKind, query: string): void {
      const normalizedValue = trimText(query);

      if (!normalizedValue) {
        return;
      }

      if (normalizedValue.length > 128) {
        openSubmissionToast({
          tone: 'warning',
          title: '程序名称过长',
          message: '自定义程序名称不能超过 128 个字符。',
        });
        return;
      }

      mutateSiteForm(kind, (form) => {
        applyProgramCustomToForm(form, normalizedValue);
      });
      setProgramPickerValue(kind, '');
      clearAutoFillMissing(kind, 'architecture');
      openSubmissionToast({
        tone: 'info',
        title: '已使用自定义程序',
        message: `当前程序：${normalizedValue}`,
      });
    },
    applyProgramCustomDraft(kind: SiteFormKind, draft: CustomProgramDraft): void {
      const normalizedValue = trimText(draft.name);

      if (!normalizedValue) {
        return;
      }

      if (normalizedValue.length > 128) {
        openSubmissionToast({
          tone: 'warning',
          title: '程序名称过长',
          message: '自定义程序名称不能超过 128 个字符。',
        });
        return;
      }

      setProgramPickerValue(kind, '');
      mutateSiteForm(kind, (form) => {
        applyProgramCustomDraftToForm(form, {
          ...draft,
          name: normalizedValue,
        });
      });
      clearAutoFillMissing(kind, 'architecture');
      openSubmissionToast({
        tone: 'info',
        title: '已使用自定义程序',
        message: `当前程序：${normalizedValue}`,
      });
    },
    addFeed(kind: SiteFormKind): void {
      mutateSiteForm(kind, addFeedToForm);
    },
    removeFeed(kind: SiteFormKind, id: string): void {
      mutateSiteForm(kind, (form) => {
        removeFeedFromForm(form, id);
      });
    },
    updateFeedName(kind: SiteFormKind, id: string, value: string): void {
      mutateSiteForm(kind, (form) => {
        updateFeedNameInForm(form, id, value);
      });
    },
    updateFeedUrl(kind: SiteFormKind, id: string, value: string): void {
      mutateSiteForm(kind, (form) => {
        const updated = updateFeedUrlInForm(form, id, value);

        if (updated) {
          clearAutoFillMissing(kind, 'feeds');
        }
      });
    },
    updateFeedType(kind: SiteFormKind, id: string, value: 'RSS' | 'ATOM' | 'JSON'): void {
      mutateSiteForm(kind, (form) => {
        updateFeedTypeInForm(form, id, value);
      });
    },
    selectDefaultFeed(kind: SiteFormKind, id: string): void {
      mutateSiteForm(kind, (form) => {
        selectDefaultFeedInForm(form, id);
      });
    },
    setAutoFillMissing,
    setProgramPickerValue,
    mutateSiteForm,
    getSiteUrlByKind,
    setAutoFillUrlError,
  };
}
