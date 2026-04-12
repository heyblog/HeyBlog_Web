import {
  requestResolvedSite,
  requestSearchSites,
  requestSiteAutoFill,
  requestSubmissionMutation,
  requestSubmissionOptions,
  requestSubmissionQuery,
  type SubmissionMutationEndpoint,
  type SubmissionMutationError,
} from '@/application/site-submission/site-submission.browser-actions';
import { clearSubmissionIdentifierSearchParams } from '@/application/site-submission/site-submission.browser-feedback';
import {
  applyAutoFillToForm,
  createEmptyAutoFillMissingState,
} from '@/application/site-submission/site-submission.browser-workspace';
import {
  buildCreateSubmissionPayload,
  buildDeleteSubmissionPayload,
  buildRestoreSubmissionPayload,
  buildSubmissionQueryPayload,
  buildUpdateSubmissionPayload,
  createInitialCreateForm,
  createInitialDeleteForm,
  createInitialRestoreForm,
  createInitialUpdateForm,
  createUpdateFormFromResolvedSite,
  type FieldErrors,
  isHttpUrl,
  type RestoreTargetResult,
  type SiteResolveRequest,
  type SubmissionResult,
  trimText,
} from '@/application/site-submission/site-submission.service';
import { openSubmissionToast } from '@/shared/browser/submission-toast.service';

import { AUTO_FILL_ALL_MISSING } from './site-submission-workspace.constants';
import type { SiteSubmissionWorkspaceControllerContext } from './site-submission-workspace.types';
import type { createSiteSubmissionWorkspaceFormController } from './site-submission-workspace-form-controller';

type FormController = ReturnType<typeof createSiteSubmissionWorkspaceFormController>;

export function createSiteSubmissionWorkspaceRequestController(
  context: SiteSubmissionWorkspaceControllerContext,
  formController: FormController,
) {
  const resetCreateSubmissionState = (): void => {
    context.forms.create.set(createInitialCreateForm());
    context.errors.create.set({});
    context.success.create.set(null);
    context.duplicate.create.set(null);
    context.blockedSubmission.set(null);
    context.autoFillMissing.create.set(createEmptyAutoFillMissingState());
    context.programPicker.create.set('');
  };

  const resetResolvedSubmissionState = (): void => {
    context.search.query.set('');
    context.search.results.set([]);
    context.search.error.set(null);
    context.search.selectedSite.set(null);
    context.forms.update.set(createInitialUpdateForm());
    context.forms.delete.set(createInitialDeleteForm());
    context.errors.update.set({});
    context.errors.delete.set({});
    context.success.update.set(null);
    context.success.delete.set(null);
    context.blockedSubmission.set(null);
    context.autoFillMissing.update.set(createEmptyAutoFillMissingState());
    context.programPicker.update.set('');
  };

  const resetRestoreSubmissionState = (): void => {
    context.forms.restore.set(createInitialRestoreForm());
    context.errors.restore.set({});
    context.success.restore.set(null);
    context.blockedSubmission.set(null);
  };

  const handleMutationSuccess = (
    kind: 'create' | 'update' | 'delete' | 'restore',
    result: SubmissionResult,
  ): void => {
    if (kind === 'create') {
      resetCreateSubmissionState();
      context.success.create.set(result);
    } else if (kind === 'restore') {
      resetRestoreSubmissionState();
      context.success.restore.set(result);
    } else {
      resetResolvedSubmissionState();
      clearSubmissionIdentifierSearchParams();
      if (kind === 'update') {
        context.success.update.set(result);
      } else {
        context.success.delete.set(result);
      }
    }
  };

  const submitMutationRequest = async (params: {
    kind: 'create' | 'update' | 'delete' | 'restore';
    endpoint: SubmissionMutationEndpoint;
    payload: unknown;
    setFieldErrors: (errors: FieldErrors) => void;
    setPending: (pending: boolean) => void;
    successTitle: string;
    errorTitle: string;
    suppressToastCodes?: string[];
  }): Promise<SubmissionMutationError | null> => {
    params.setPending(true);
    try {
      const result = await requestSubmissionMutation({
        endpoint: params.endpoint,
        payload: params.payload,
        successTitle: params.successTitle,
        errorTitle: params.errorTitle,
        suppressToastCodes: params.suppressToastCodes,
      });
      if (result.ok) {
        handleMutationSuccess(params.kind, result.data);
        return null;
      }
      context.blockedSubmission.set(
        result.error.code === 'PENDING_AUDIT_EXISTS' && result.error.activeSubmission
          ? {
              message: result.error.message,
              submission: result.error.activeSubmission,
            }
          : null,
      );
      params.setFieldErrors(result.error.fieldErrors);
      return result.error;
    } finally {
      params.setPending(false);
    }
  };

  const submitWithPayload = async (params: {
    build: () => { ok: true; data: unknown } | { ok: false; fieldErrors: FieldErrors };
    setErrors: (errors: FieldErrors) => void;
    clearSuccess: () => void;
    kind: 'create' | 'update' | 'delete' | 'restore';
    endpoint: SubmissionMutationEndpoint;
    successTitle: string;
    errorTitle: string;
    setPending: (pending: boolean) => void;
    suppressToastCodes?: string[];
  }): Promise<SubmissionMutationError | null> => {
    params.setErrors({});
    params.clearSuccess();
    context.blockedSubmission.set(null);
    const parsed = params.build();
    if (!parsed.ok) {
      params.setErrors(parsed.fieldErrors);
      return null;
    }
    return submitMutationRequest({
      kind: params.kind,
      endpoint: params.endpoint,
      payload: parsed.data,
      setFieldErrors: params.setErrors,
      setPending: params.setPending,
      successTitle: params.successTitle,
      errorTitle: params.errorTitle,
      suppressToastCodes: params.suppressToastCodes,
    });
  };

  const loadOptions = async (): Promise<void> => {
    context.optionsPending.set(true);
    try {
      const nextOptions = await requestSubmissionOptions(context.activePage);
      if (nextOptions) {
        context.options.set(nextOptions);
      }
    } finally {
      context.optionsPending.set(false);
    }
  };

  const resolveSite = async (target: string | SiteResolveRequest): Promise<void> => {
    context.pending.resolve.set(true);
    context.search.error.set(null);
    try {
      const result = await requestResolvedSite(target);
      if (!result.ok) {
        context.search.error.set(result.error);
        return;
      }
      context.search.selectedSite.set(result.data);
      context.forms.update.set(createUpdateFormFromResolvedSite(result.data));
      context.forms.delete.set({
        ...context.forms.delete.get(),
        site_identifier: result.data.site_id,
      });
      context.search.query.set(result.data.url);
      context.success.update.set(null);
      context.success.delete.set(null);
    } finally {
      context.pending.resolve.set(false);
    }
  };

  const runSearch = async (): Promise<void> => {
    const query = trimText(context.search.query.get());
    if (!query) {
      context.search.error.set('请输入站点名称或部分地址。');
      return;
    }

    context.pending.search.set(true);
    context.search.error.set(null);
    context.search.results.set([]);
    try {
      const result = await requestSearchSites(query);
      if (result.ok) {
        context.search.results.set(result.data);
        if (result.data.length === 0) {
          context.search.error.set('没有找到匹配的站点，请改用更完整的地址或唯一标识。');
        }
        return;
      }
      context.search.error.set(result.error);
    } finally {
      context.pending.search.set(false);
    }
  };

  const runAutoFill = async (kind: 'create' | 'update'): Promise<void> => {
    const url = formController.getSiteUrlByKind(kind);
    if (!isHttpUrl(url)) {
      formController.setAutoFillUrlError(kind);
      return;
    }

    context.pending.autoFill.set(true);
    context.pending.autoFillTarget.set(kind);
    formController.setAutoFillMissing(kind, createEmptyAutoFillMissingState());
    try {
      const result = await requestSiteAutoFill(url);
      if (!result.ok) {
        formController.setAutoFillMissing(kind, AUTO_FILL_ALL_MISSING);
        return;
      }

      formController.mutateSiteForm(kind, (form) => {
        applyAutoFillToForm(form, result.data, (value) => {
          formController.setProgramPickerValue(kind, value);
        });
      });

      if (result.evaluation.successCount === 6) {
        formController.setAutoFillMissing(kind, createEmptyAutoFillMissingState());
        openSubmissionToast({ tone: 'success', title: '自动填写', message: '已成功获取信息。' });
        return;
      }

      if (result.evaluation.successCount === 0) {
        formController.setAutoFillMissing(kind, AUTO_FILL_ALL_MISSING);
        openSubmissionToast({
          tone: 'error',
          title: '自动填写',
          message: '获取失败，请手动填写或稍后重试。',
        });
        return;
      }

      formController.setAutoFillMissing(kind, result.evaluation.missing);
      openSubmissionToast({
        tone: 'warning',
        title: '自动填写',
        message: '获取到部分信息，请补充完善其余信息。',
      });
    } finally {
      context.pending.autoFill.set(false);
      context.pending.autoFillTarget.set(null);
    }
  };

  const submitCreateRequest = async (confirmedSiteIds?: string[]): Promise<void> => {
    context.duplicate.create.set(null);

    const result = await submitWithPayload({
      build: () => {
        const built = buildCreateSubmissionPayload(context.forms.create.get());

        if (!built.ok) {
          return built;
        }

        if (!confirmedSiteIds || confirmedSiteIds.length === 0) {
          return built;
        }

        return {
          ok: true as const,
          data: {
            ...built.data,
            duplicate_review: {
              confirmed_site_ids: confirmedSiteIds,
            },
          },
        };
      },
      setErrors: context.errors.create.set,
      clearSuccess: () => {
        context.success.create.set(null);
        context.duplicate.create.set(null);
      },
      kind: 'create',
      endpoint: '/api/site-submissions/create',
      successTitle: '新增申请已进入审核',
      errorTitle: '提交未完成',
      setPending: context.pending.create.set,
      suppressToastCodes: [
        'PENDING_AUDIT_EXISTS',
        'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED',
        'SITE_DUPLICATE_STRONG_CONTACT_REQUIRED',
        'SITE_RESTORE_REQUIRED',
      ],
    });

    if (
      result?.duplicateReview &&
      (result.code === 'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED' ||
        result.code === 'SITE_DUPLICATE_STRONG_CONTACT_REQUIRED' ||
        result.code === 'SITE_RESTORE_REQUIRED')
    ) {
      context.duplicate.create.set({
        code: result.code,
        message: result.message,
        review: result.duplicateReview,
      });
    }
  };

  const submitCreate = async (): Promise<void> => {
    await submitCreateRequest();
  };

  const confirmCreateDuplicateReview = async (): Promise<void> => {
    const current = context.duplicate.create.get();

    if (!current || current.code !== 'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED') {
      return;
    }

    await submitCreateRequest(current.review.weak.map((candidate) => candidate.site_id));
  };

  const dismissCreateDuplicateReview = (): void => {
    context.duplicate.create.set(null);
  };

  const submitUpdate = async (): Promise<void> => {
    const selectedSite = context.search.selectedSite.get();
    if (!selectedSite) {
      return;
    }
    await submitWithPayload({
      build: () => buildUpdateSubmissionPayload(context.forms.update.get(), selectedSite),
      setErrors: context.errors.update.set,
      clearSuccess: () => context.success.update.set(null),
      kind: 'update',
      endpoint: '/api/site-submissions/update',
      successTitle: '修订申请已进入审核',
      errorTitle: '修订未提交',
      setPending: context.pending.update.set,
      suppressToastCodes: ['PENDING_AUDIT_EXISTS'],
    });
  };

  const submitDelete = async (): Promise<void> => {
    await submitWithPayload({
      build: () => buildDeleteSubmissionPayload(context.forms.delete.get()),
      setErrors: context.errors.delete.set,
      clearSuccess: () => context.success.delete.set(null),
      kind: 'delete',
      endpoint: '/api/site-submissions/delete',
      successTitle: '删除申请已进入审核',
      errorTitle: '删除申请未提交',
      setPending: context.pending.delete.set,
      suppressToastCodes: ['PENDING_AUDIT_EXISTS'],
    });
  };

  const submitRestore = async (): Promise<void> => {
    const target = context.restore.target.get();
    await submitWithPayload({
      build: () =>
        buildRestoreSubmissionPayload(target?.site_id ?? '', context.forms.restore.get()),
      setErrors: context.errors.restore.set,
      clearSuccess: () => context.success.restore.set(null),
      kind: 'restore',
      endpoint: '/api/site-submissions/restore',
      successTitle: '恢复申请已进入审核',
      errorTitle: '恢复申请未提交',
      setPending: context.pending.restore.set,
      suppressToastCodes: ['PENDING_AUDIT_EXISTS'],
    });
  };

  const submitQuery = async (): Promise<void> => {
    context.errors.queryError.set(null);
    context.errors.query.set({});
    context.success.query.set(null);
    const parsed = buildSubmissionQueryPayload(context.forms.query.get());
    if (!parsed.ok) {
      context.errors.query.set(parsed.fieldErrors);
      openSubmissionToast({
        tone: 'warning',
        title: '查询未完成',
        message: parsed.formError ?? '请先修正查询字段。',
      });
      return;
    }

    context.pending.query.set(true);
    try {
      const result = await requestSubmissionQuery(parsed.data);
      if (result.ok) {
        context.success.query.set(result.data);
        return;
      }
      context.errors.query.set(result.fieldErrors);
    } finally {
      context.pending.query.set(false);
    }
  };

  const initialize = async (params: {
    initialIdentifier: string;
    initialAuditId: string;
    initialRestoreTarget?: RestoreTargetResult | null;
  }): Promise<void> => {
    await loadOptions();
    if (
      (context.activePage === 'update' || context.activePage === 'delete') &&
      trimText(params.initialIdentifier)
    ) {
      await resolveSite(params.initialIdentifier);
    }
    if (context.activePage === 'restore') {
      context.restore.target.set(params.initialRestoreTarget ?? null);
    }
    if (context.activePage === 'query' && trimText(params.initialAuditId)) {
      await submitQuery();
    }
  };

  return {
    loadOptions,
    resolveSite,
    runSearch,
    runAutoFill,
    submitCreate,
    confirmCreateDuplicateReview,
    dismissCreateDuplicateReview,
    submitUpdate,
    submitDelete,
    submitRestore,
    submitQuery,
    initialize,
  };
}
