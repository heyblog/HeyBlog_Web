<script lang="ts">
  import { onMount } from 'svelte';

  import {
    getPublicContactEmail,
    getPublicContactMailtoHref,
  } from '@/application/shared/public-contact';
  import {
    buildSubmissionQueryHref,
    copySubmissionAuditId,
  } from '@/application/site-submission/site-submission.browser-feedback';
  import {
    type AutoFillMissingState,
    createEmptyAutoFillMissingState,
  } from '@/application/site-submission/site-submission.browser-workspace';
  import {
    createInitialCreateForm,
    createInitialDeleteForm,
    createInitialQueryForm,
    createInitialRestoreForm,
    createInitialUpdateForm,
    type FieldErrors,
    formatAuditTime,
    type RestoreTargetResult,
    type SiteResolveResult,
    type SiteSearchItem,
    type SiteSubmissionOptionsResult,
    type SubmissionPage,
    type SubmissionResult,
    type SubmissionStatusResult,
  } from '@/application/site-submission/site-submission.service';
  import { statusToneClass } from '@/application/site-submission/site-submission.status-tone';
  import ModalSurface from '@/shared/ui/ModalSurface.svelte';

  import {
    WORKSPACE_INPUT_CLASS,
    WORKSPACE_SELECT_CHEVRON_STYLE,
    WORKSPACE_SELECT_CLASS,
    WORKSPACE_TEXTAREA_CLASS,
  } from './site-submission-workspace.constants';
  import type {
    BlockedSubmissionNoticeState,
    CreateSubmissionDuplicateDialogState,
  } from './site-submission-workspace.types';
  import {
    createSiteSubmissionWorkspaceController,
    type ValueState,
  } from './site-submission-workspace-controller';
  import SiteSubmissionWorkspacePanel from './SiteSubmissionWorkspacePanel.svelte';
  import WorkspaceAside from './WorkspaceAside.svelte';

  export let activePage: SubmissionPage = 'create';
  export let initialIdentifier = '';
  export let initialAuditId = '';
  export let initialRestoreTarget: RestoreTargetResult | null = null;

  let options: SiteSubmissionOptionsResult = {
    main_tags: [],
    sub_tags: [],
    programs: [],
    tech_stacks: [],
  };
  let optionsPending = false;

  let createForm = createInitialCreateForm();
  let updateForm = createInitialUpdateForm();
  let deleteForm = createInitialDeleteForm();
  let restoreForm = createInitialRestoreForm();
  let queryForm = createInitialQueryForm({
    audit_id: initialAuditId,
  });

  let createErrors: FieldErrors = {};
  let updateErrors: FieldErrors = {};
  let deleteErrors: FieldErrors = {};
  let restoreErrors: FieldErrors = {};
  let queryErrors: FieldErrors = {};

  let queryError: string | null = null;

  let createSuccess: SubmissionResult | null = null;
  let updateSuccess: SubmissionResult | null = null;
  let deleteSuccess: SubmissionResult | null = null;
  let restoreSuccess: SubmissionResult | null = null;
  let querySuccess: SubmissionStatusResult | null = null;
  let createDuplicateDialog: CreateSubmissionDuplicateDialogState | null = null;
  let blockedSubmission: BlockedSubmissionNoticeState | null = null;

  let createPending = false;
  let updatePending = false;
  let deletePending = false;
  let restorePending = false;
  let queryPending = false;
  let searchPending = false;
  let resolvePending = false;
  let autoFillPending = false;
  let autoFillTarget: 'create' | 'update' | null = null;
  let createAutoFillMissing: AutoFillMissingState = createEmptyAutoFillMissingState();
  let updateAutoFillMissing: AutoFillMissingState = createEmptyAutoFillMissingState();

  let searchQuery = initialIdentifier;
  let searchResults: SiteSearchItem[] = [];
  let searchError: string | null = null;
  let selectedSite: SiteResolveResult | null = null;
  let restoreTarget: RestoreTargetResult | null = initialRestoreTarget;
  let createProgramPickerValue = '';
  let updateProgramPickerValue = '';
  let copiedAuditId = '';
  const publicContactEmail = getPublicContactEmail();
  const publicContactMailtoHref = getPublicContactMailtoHref();

  const state = <T,>(get: () => T, set: (value: T) => void): ValueState<T> => ({
    get,
    set,
  });

  const controller = createSiteSubmissionWorkspaceController({
    activePage,
    options: state(
      () => options,
      (value) => {
        options = value;
      },
    ),
    optionsPending: state(
      () => optionsPending,
      (value) => {
        optionsPending = value;
      },
    ),
    forms: {
      create: state(
        () => createForm,
        (value) => {
          createForm = value;
        },
      ),
      update: state(
        () => updateForm,
        (value) => {
          updateForm = value;
        },
      ),
      delete: state(
        () => deleteForm,
        (value) => {
          deleteForm = value;
        },
      ),
      restore: state(
        () => restoreForm,
        (value) => {
          restoreForm = value;
        },
      ),
      query: state(
        () => queryForm,
        (value) => {
          queryForm = value;
        },
      ),
    },
    errors: {
      create: state(
        () => createErrors,
        (value) => {
          createErrors = value;
        },
      ),
      update: state(
        () => updateErrors,
        (value) => {
          updateErrors = value;
        },
      ),
      delete: state(
        () => deleteErrors,
        (value) => {
          deleteErrors = value;
        },
      ),
      restore: state(
        () => restoreErrors,
        (value) => {
          restoreErrors = value;
        },
      ),
      query: state(
        () => queryErrors,
        (value) => {
          queryErrors = value;
        },
      ),
      queryError: state(
        () => queryError,
        (value) => {
          queryError = value;
        },
      ),
    },
    success: {
      create: state(
        () => createSuccess,
        (value) => {
          createSuccess = value;
        },
      ),
      update: state(
        () => updateSuccess,
        (value) => {
          updateSuccess = value;
        },
      ),
      delete: state(
        () => deleteSuccess,
        (value) => {
          deleteSuccess = value;
        },
      ),
      restore: state(
        () => restoreSuccess,
        (value) => {
          restoreSuccess = value;
        },
      ),
      query: state(
        () => querySuccess,
        (value) => {
          querySuccess = value;
        },
      ),
    },
    duplicate: {
      create: state(
        () => createDuplicateDialog,
        (value) => {
          createDuplicateDialog = value;
        },
      ),
    },
    blockedSubmission: state(
      () => blockedSubmission,
      (value) => {
        blockedSubmission = value;
      },
    ),
    pending: {
      create: state(
        () => createPending,
        (value) => {
          createPending = value;
        },
      ),
      update: state(
        () => updatePending,
        (value) => {
          updatePending = value;
        },
      ),
      delete: state(
        () => deletePending,
        (value) => {
          deletePending = value;
        },
      ),
      restore: state(
        () => restorePending,
        (value) => {
          restorePending = value;
        },
      ),
      query: state(
        () => queryPending,
        (value) => {
          queryPending = value;
        },
      ),
      search: state(
        () => searchPending,
        (value) => {
          searchPending = value;
        },
      ),
      resolve: state(
        () => resolvePending,
        (value) => {
          resolvePending = value;
        },
      ),
      autoFill: state(
        () => autoFillPending,
        (value) => {
          autoFillPending = value;
        },
      ),
      autoFillTarget: state(
        () => autoFillTarget,
        (value) => {
          autoFillTarget = value;
        },
      ),
    },
    search: {
      query: state(
        () => searchQuery,
        (value) => {
          searchQuery = value;
        },
      ),
      results: state(
        () => searchResults,
        (value) => {
          searchResults = value;
        },
      ),
      error: state(
        () => searchError,
        (value) => {
          searchError = value;
        },
      ),
      selectedSite: state(
        () => selectedSite,
        (value) => {
          selectedSite = value;
        },
      ),
    },
    restore: {
      target: state(
        () => restoreTarget,
        (value) => {
          restoreTarget = value;
        },
      ),
    },
    autoFillMissing: {
      create: state(
        () => createAutoFillMissing,
        (value) => {
          createAutoFillMissing = value;
        },
      ),
      update: state(
        () => updateAutoFillMissing,
        (value) => {
          updateAutoFillMissing = value;
        },
      ),
    },
    programPicker: {
      create: state(
        () => createProgramPickerValue,
        (value) => {
          createProgramPickerValue = value;
        },
      ),
      update: state(
        () => updateProgramPickerValue,
        (value) => {
          updateProgramPickerValue = value;
        },
      ),
    },
  });

  const inputClass = WORKSPACE_INPUT_CLASS;
  const selectClass = WORKSPACE_SELECT_CLASS;
  const selectChevronStyle = WORKSPACE_SELECT_CHEVRON_STYLE;
  const textAreaClass = WORKSPACE_TEXTAREA_CLASS;
  const successTitleMap = {
    CREATE: '新增申请已进入审核',
    UPDATE: '修订申请已进入审核',
    DELETE: '删除申请已进入审核',
    RESTORE: '恢复申请已进入审核',
  } as const;
  let activeSubmissionResult: SubmissionResult | null = null;
  let activeSubmissionTitle: string;
  let duplicateDialogTitle: string;
  let primaryStrongDuplicate: {
    site_id: string;
    bid: string | null;
    name: string;
    url: string;
    visibility: 'VISIBLE' | 'HIDDEN';
    reason: string;
  } | null;
  let blockedSubmissionQueryHref;

  $: activeSubmissionResult =
    createSuccess ?? updateSuccess ?? deleteSuccess ?? restoreSuccess ?? null;
  $: activeSubmissionTitle = activeSubmissionResult
    ? (successTitleMap[activeSubmissionResult.action as keyof typeof successTitleMap] ??
      '提交申请已进入审核')
    : '';
  $: duplicateDialogTitle =
    createDuplicateDialog?.code === 'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED'
      ? '检测到疑似重复站点'
      : createDuplicateDialog?.code === 'SITE_RESTORE_REQUIRED'
        ? '检测到已下线站点'
        : createDuplicateDialog?.code === 'SITE_DUPLICATE_STRONG_CONTACT_REQUIRED'
          ? '检测到重复站点'
          : '';
  $: primaryStrongDuplicate = createDuplicateDialog?.review.strong[0] ?? null;
  $: blockedSubmissionQueryHref = blockedSubmission
    ? buildSubmissionQueryHref(blockedSubmission.submission.audit_id)
    : '';

  const {
    withInputStateClass,
    isAutoFillMissing,
    clearAutoFillMissing,
    fieldNeedsRefinement,
    updateCreateUrl,
    updateUpdateUrl,
    applyAddressInference,
    selectProgramOption,
    applyProgramCustomDraft,
    addFeed,
    removeFeed,
    updateFeedName,
    updateFeedType,
    updateFeedUrl,
    selectDefaultFeed,
    getProgramPickerSelected,
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
  } = controller;

  onMount(async () => {
    await controller.initialize({ initialIdentifier, initialAuditId, initialRestoreTarget });
  });

  async function handleCopyAuditId(auditId: string) {
    await copySubmissionAuditId(auditId);
    copiedAuditId = auditId;
  }

  function closeSubmissionResultDialog() {
    createSuccess = null;
    updateSuccess = null;
    deleteSuccess = null;
    restoreSuccess = null;
    copiedAuditId = '';
  }

  function closeCreateDuplicateDialog() {
    dismissCreateDuplicateReview();
  }

  function closeBlockedSubmissionDialog() {
    blockedSubmission = null;
  }

  function goToBlockedSubmissionQuery() {
    if (!blockedSubmission) {
      return;
    }

    const targetHref = buildSubmissionQueryHref(blockedSubmission.submission.audit_id);
    blockedSubmission = null;
    window.location.assign(targetHref);
  }
</script>

<div
  class={`grid gap-6 ${
    activePage === 'query' ? 'mx-auto max-w-4xl' : 'lg:grid-cols-[minmax(0,1fr)_22rem]'
  }`}
>
  <SiteSubmissionWorkspacePanel
    {activePage}
    {autoFillPending}
    {autoFillTarget}
    {createForm}
    {createErrors}
    {createPending}
    createProgramSelectedId={getProgramPickerSelected('create')}
    {deleteForm}
    {deleteErrors}
    {deletePending}
    {restoreForm}
    {restoreErrors}
    {restorePending}
    {restoreTarget}
    {fieldNeedsRefinement}
    {inputClass}
    {isAutoFillMissing}
    {options}
    {optionsPending}
    {queryErrors}
    {queryForm}
    {queryPending}
    {querySuccess}
    {resolvePending}
    {searchError}
    {searchPending}
    bind:searchQuery
    {searchResults}
    {selectClass}
    {selectChevronStyle}
    {selectedSite}
    {statusToneClass}
    {textAreaClass}
    {updateErrors}
    {updateForm}
    {updatePending}
    updateProgramSelectedId={getProgramPickerSelected('update')}
    {withInputStateClass}
    {addFeed}
    {applyAddressInference}
    {applyProgramCustomDraft}
    {clearAutoFillMissing}
    {removeFeed}
    {resolveSite}
    {runAutoFill}
    {runSearch}
    {selectDefaultFeed}
    {selectProgramOption}
    {submitCreate}
    {submitDelete}
    {submitRestore}
    {submitQuery}
    {submitUpdate}
    {updateCreateUrl}
    {updateFeedName}
    {updateFeedType}
    {updateFeedUrl}
    {updateUpdateUrl}
  />

  {#if activePage !== 'query'}
    <WorkspaceAside {activePage} />
  {/if}
</div>

<ModalSurface
  open={Boolean(blockedSubmission)}
  title="已有待审核申请"
  description={blockedSubmission?.message ?? ''}
  tone="warning"
  confirmLabel="前往查询页"
  cancelLabel="关闭"
  showCancel={true}
  showHeaderClose={true}
  headerCloseAriaLabel="关闭待审核提示"
  onConfirm={goToBlockedSubmissionQuery}
  onCancel={closeBlockedSubmissionDialog}
>
  {#if blockedSubmission}
    <div class="space-y-2 text-sm">
      <p>查询编号：{blockedSubmission.submission.audit_id}</p>
      <p>提交动作：{blockedSubmission.submission.action}</p>
      <p>提交时间：{formatAuditTime(blockedSubmission.submission.created_time)}</p>
      <a
        class="inline-flex items-center rounded-md border border-(--color-line-med) px-3 py-1.5 text-xs text-(--color-fg) transition hover:border-(--color-line-strong)"
        href={blockedSubmissionQueryHref}
      >
        打开查询页
      </a>
    </div>
  {/if}
</ModalSurface>

<ModalSurface
  open={Boolean(createDuplicateDialog)}
  title={duplicateDialogTitle}
  description={createDuplicateDialog?.message ?? ''}
  tone={createDuplicateDialog?.code === 'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED'
    ? 'warning'
    : 'danger'}
  confirmLabel={createDuplicateDialog?.code === 'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED'
    ? '继续新增'
    : '关闭'}
  cancelLabel="返回表单"
  showCancel={createDuplicateDialog?.code === 'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED'}
  showHeaderClose={true}
  headerCloseAriaLabel="关闭重复提示"
  onConfirm={() => {
    if (createDuplicateDialog?.code === 'SITE_DUPLICATE_WEAK_CONFIRMATION_REQUIRED') {
      void confirmCreateDuplicateReview();
      return;
    }

    closeCreateDuplicateDialog();
  }}
  onCancel={closeCreateDuplicateDialog}
>
  {#if createDuplicateDialog}
    <div class="space-y-4">
      {#if createDuplicateDialog.review.strong.length > 0}
        <div class="space-y-3">
          <p class="text-xs tracking-[0.18em] text-(--color-fg-3) uppercase">已命中站点</p>
          {#each createDuplicateDialog.review.strong as candidate (candidate.site_id)}
            <article class="rounded-md border border-(--color-line-med) bg-(--color-bg) px-4 py-4">
              <div class="flex flex-wrap items-center gap-2 text-sm text-(--color-fg)">
                <span class="font-medium">{candidate.name}</span>
                {#if candidate.bid}
                  <span
                    class="rounded-sm border border-(--color-line-med) px-2 py-0.5 text-xs text-(--color-fg-2)"
                  >
                    {candidate.bid}
                  </span>
                {/if}
              </div>
              <p class="mt-2 text-sm break-all text-(--color-fg-2)">{candidate.url}</p>
              <p class="mt-2 text-xs text-(--color-fg-3)">{candidate.reason}</p>
              <a
                class="mt-3 inline-flex items-center rounded-md border border-(--color-line-med) px-3 py-1.5 text-xs text-(--color-fg) transition hover:border-(--color-line-strong)"
                href={candidate.url}
                rel="noreferrer"
                target="_blank"
              >
                查看站点
              </a>
            </article>
          {/each}
        </div>
      {/if}

      {#if createDuplicateDialog.review.weak.length > 0}
        <div class="space-y-3">
          <p class="text-xs tracking-[0.18em] text-(--color-fg-3) uppercase">疑似重复候选</p>
          {#each createDuplicateDialog.review.weak as candidate (candidate.site_id)}
            <article class="rounded-md border border-(--color-line-med) bg-(--color-bg) px-4 py-4">
              <div class="flex flex-wrap items-center gap-2 text-sm text-(--color-fg)">
                <span class="font-medium">{candidate.name}</span>
                {#if candidate.bid}
                  <span
                    class="rounded-sm border border-(--color-line-med) px-2 py-0.5 text-xs text-(--color-fg-2)"
                  >
                    {candidate.bid}
                  </span>
                {/if}
              </div>
              <p class="mt-2 text-sm break-all text-(--color-fg-2)">{candidate.url}</p>
              <p class="mt-2 text-xs text-(--color-fg-3)">{candidate.reason}</p>
              <a
                class="mt-3 inline-flex items-center rounded-md border border-(--color-line-med) px-3 py-1.5 text-xs text-(--color-fg) transition hover:border-(--color-line-strong)"
                href={candidate.url}
                rel="noreferrer"
                target="_blank"
              >
                查看站点
              </a>
            </article>
          {/each}
        </div>
      {/if}

      {#if createDuplicateDialog.code === 'SITE_DUPLICATE_STRONG_CONTACT_REQUIRED'}
        <div class="flex flex-wrap gap-3">
          {#if publicContactMailtoHref}
            <a
              class="inline-flex items-center rounded-md border border-(--color-line-med) px-4 py-2 text-sm text-(--color-fg) transition hover:border-(--color-line-strong)"
              href={publicContactMailtoHref}
            >
              通过邮箱反馈
            </a>
          {/if}
          {#if publicContactEmail}
            <p class="text-sm text-(--color-fg-2)">联系邮箱：{publicContactEmail}</p>
          {:else}
            <p class="text-sm text-(--color-fg-2)">请联系站点维护方邮箱确认是否需要恢复或修订。</p>
          {/if}
        </div>
      {/if}

      {#if createDuplicateDialog.code === 'SITE_RESTORE_REQUIRED' && primaryStrongDuplicate}
        <div class="flex flex-wrap gap-3">
          <a
            class="inline-flex items-center rounded-md border border-(--color-line-med) px-4 py-2 text-sm text-(--color-fg) transition hover:border-(--color-line-strong)"
            href={`/site/submit/restore?site_id=${encodeURIComponent(primaryStrongDuplicate.site_id)}`}
          >
            前往恢复申请
          </a>
        </div>
      {/if}
    </div>
  {/if}
</ModalSurface>

<ModalSurface
  open={Boolean(activeSubmissionResult)}
  title={activeSubmissionTitle}
  description="请保存查询编号，后续可在查询页查看处理进度。"
  tone="info"
  confirmLabel="关闭"
  cancelLabel=""
  showCancel={false}
  showHeaderClose={true}
  headerCloseAriaLabel="关闭结果提示"
  onConfirm={closeSubmissionResultDialog}
  onCancel={closeSubmissionResultDialog}
>
  {#if activeSubmissionResult}
    <div class="space-y-4">
      <div class="rounded-md border border-(--color-line-med) bg-(--color-bg) px-4 py-4">
        <p class="font-mono text-[11px] tracking-[0.18em] text-(--color-info) uppercase">
          查询编号
        </p>
        <p class="mt-3 font-mono text-sm text-(--color-fg)">{activeSubmissionResult.audit_id}</p>
      </div>

      <div class="flex flex-wrap gap-3">
        <button
          class="rounded-md border border-(--color-line-med) px-4 py-2 text-sm text-(--color-fg) transition hover:border-(--color-line-strong)"
          type="button"
          on:click={() => handleCopyAuditId(activeSubmissionResult.audit_id)}
        >
          {copiedAuditId === activeSubmissionResult.audit_id ? '已复制查询 ID' : '复制查询 ID'}
        </button>
        <a
          class="inline-flex items-center rounded-md border border-(--color-line-med) px-4 py-2 text-sm text-(--color-fg) transition hover:border-(--color-line-strong)"
          href={buildSubmissionQueryHref(activeSubmissionResult.audit_id)}
        >
          前往查询页
        </a>
      </div>
    </div>
  {/if}
</ModalSurface>
