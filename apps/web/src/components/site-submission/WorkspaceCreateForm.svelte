<script lang="ts">
  import { type CustomProgramDraft } from '@/application/site-submission/site-submission.browser-form';
  import type { AutoFillFieldKey } from '@/application/site-submission/site-submission.browser-workspace';
  import {
    type CreateSubmissionFormState,
    FEED_TYPE_OPTIONS,
    type FieldErrors,
    type SiteSubmissionOptionsResult,
  } from '@/application/site-submission/site-submission.service';

  import SiteEditableFields from './SiteEditableFields.svelte';

  export let autoFillPending = false;
  export let autoFillTarget: 'create' | 'update' | null = null;
  export let submitCreate: () => Promise<void>;

  export let createForm: CreateSubmissionFormState;
  export let createErrors: FieldErrors = {};
  export let createPending = false;

  export let inputClass = '';
  export let textAreaClass = '';
  export let selectClass = '';
  export let selectChevronStyle = '';

  export let withInputStateClass: (base: string, warned: boolean, missing: boolean) => string;
  export let isAutoFillMissing: (kind: 'create' | 'update', field: AutoFillFieldKey) => boolean;
  export let clearAutoFillMissing: (kind: 'create' | 'update', field: AutoFillFieldKey) => void;
  export let fieldNeedsRefinement: (kind: 'create' | 'update', value: string) => boolean;

  export let updateCreateUrl: (value: string) => void;
  export let applyAddressInference: (kind: 'create' | 'update') => void;
  export let runAutoFill: (kind: 'create' | 'update') => Promise<void>;
  export let addFeed: (kind: 'create' | 'update') => void;
  export let removeFeed: (kind: 'create' | 'update', id: string) => void;
  export let updateFeedName: (kind: 'create' | 'update', id: string, value: string) => void;
  export let updateFeedType: (
    kind: 'create' | 'update',
    id: string,
    value: 'RSS' | 'ATOM' | 'JSON',
  ) => void;
  export let updateFeedUrl: (kind: 'create' | 'update', id: string, value: string) => void;
  export let selectDefaultFeed: (kind: 'create' | 'update', id: string) => void;

  export let optionsPending = false;
  export let options: SiteSubmissionOptionsResult;
  export let createProgramSelectedId = '';
  export let selectProgramForCreate: (id: string) => void;
  export let applyProgramCustomDraftForCreate: (draft: CustomProgramDraft) => void;
  export let trimText: (value: string) => string;
</script>

<form class="relative mt-6 space-y-6" on:submit|preventDefault={submitCreate}>
  {#if autoFillPending && autoFillTarget === 'create'}
    <div
      class="absolute inset-0 z-20 flex items-center justify-center rounded-md bg-(--color-bg)/65 backdrop-blur-[1.5px]"
    >
      <div class="flex flex-col items-center gap-2">
        <span
          class="h-6 w-6 animate-spin rounded-full border-2 border-red-700 border-t-transparent dark:border-red-400 dark:border-t-transparent"
          aria-hidden="true"
        ></span>
        <p class="text-sm text-(--color-fg-2)">自动抓取中，请稍候...</p>
      </div>
    </div>
  {/if}

  <SiteEditableFields
    mode="create"
    form={createForm}
    errors={createErrors}
    {options}
    {optionsPending}
    {inputClass}
    {textAreaClass}
    {selectClass}
    {selectChevronStyle}
    selectedProgramId={createProgramSelectedId}
    {withInputStateClass}
    isAutoFillMissing={(field) => isAutoFillMissing('create', field)}
    clearAutoFillMissing={(field) => clearAutoFillMissing('create', field)}
    fieldNeedsRefinement={(value) => fieldNeedsRefinement('create', value)}
    updateUrl={updateCreateUrl}
    applyAddressInference={() => applyAddressInference('create')}
    runAutoFill={() => runAutoFill('create')}
    addFeed={() => addFeed('create')}
    removeFeed={(id) => removeFeed('create', id)}
    updateFeedName={(id, value) => updateFeedName('create', id, value)}
    allowFeedTypeSelect={true}
    feedTypeOptions={FEED_TYPE_OPTIONS}
    updateFeedType={(id, value) => updateFeedType('create', id, value)}
    updateFeedUrl={(id, value) => updateFeedUrl('create', id, value)}
    selectDefaultFeed={(id) => selectDefaultFeed('create', id)}
    selectProgram={selectProgramForCreate}
    applyProgramCustomDraft={applyProgramCustomDraftForCreate}
    {trimText}
  />

  <div class="space-y-4 border-t border-(--color-line) pt-5">
    <p class="text-xs tracking-[0.16em] text-(--color-fg-3)">提交信息与通知</p>
    <label class="flex items-start gap-3 text-sm">
      <input
        class="h-4 w-4"
        style="accent-color: var(--color-info);"
        type="checkbox"
        bind:checked={createForm.notify_by_email}
      />
      <span class="leading-7">审核完成后通过邮件通知我结果（可选）。</span>
    </label>
    {#if createForm.notify_by_email}
      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="block text-sm" for="create-submitter-name">提交者昵称</label>
          <input
            id="create-submitter-name"
            class={inputClass}
            bind:value={createForm.submitter_name}
            placeholder="例如：Alice"
          />
          {#if createErrors.submitter_name}
            <p class="text-xs text-(--color-fail)">{createErrors.submitter_name}</p>
          {/if}
        </div>
        <div class="space-y-2">
          <label class="block text-sm" for="create-submitter-email">提交者邮箱</label>
          <input
            id="create-submitter-email"
            class={inputClass}
            bind:value={createForm.submitter_email}
            placeholder="name@example.com"
            inputmode="email"
          />
          {#if createErrors.submitter_email}
            <p class="text-xs text-(--color-fail)">{createErrors.submitter_email}</p>
          {/if}
        </div>
      </div>
    {/if}
    <label class="flex items-start gap-3 text-sm">
      <input
        class="h-4 w-4"
        style="accent-color: var(--color-info);"
        type="checkbox"
        bind:checked={createForm.agree_terms}
      />
      <span class="leading-7"
        >我确认提交信息真实可用，并同意进入人工审核流程。<span
          class="ml-1 text-(--color-fail)"
          aria-hidden="true">✱</span
        ></span
      >
    </label>
    {#if createErrors.agree_terms}
      <p class="text-xs text-(--color-fail)">{createErrors.agree_terms}</p>
    {/if}
  </div>

  <button
    class="inline-flex min-h-11 items-center justify-center rounded-md border border-red-700/20 px-4 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/20 dark:text-red-400"
    disabled={createPending}
    type="submit"
  >
    {createPending ? '提交中...' : '提交新增申请'}
  </button>
</form>
