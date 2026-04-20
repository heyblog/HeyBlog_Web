<script lang="ts">
  import type { CustomProgramDraft } from '@/application/site-submission/site-submission.browser-form';
  import type { AutoFillFieldKey } from '@/application/site-submission/site-submission.browser-workspace';
  import {
    type CreateSubmissionFormState,
    type DeleteSubmissionFormState,
    type FieldErrors,
    type QuerySubmissionFormState,
    type RestoreSubmissionFormState,
    type RestoreTargetResult,
    type SiteResolveRequest,
    type SiteResolveResult,
    type SiteSearchItem,
    type SiteSubmissionOptionsResult,
    type SubmissionPage,
    type SubmissionStatusResult,
    trimText,
    type UpdateSubmissionFormState,
  } from '@/application/site-submission/site-submission.service';

  import WorkspaceCreateForm from './WorkspaceCreateForm.svelte';
  import WorkspaceDeleteForm from './WorkspaceDeleteForm.svelte';
  import WorkspaceHeader from './WorkspaceHeader.svelte';
  import WorkspaceQueryForm from './WorkspaceQueryForm.svelte';
  import WorkspaceRestoreForm from './WorkspaceRestoreForm.svelte';
  import WorkspaceSiteResolver from './WorkspaceSiteResolver.svelte';
  import WorkspaceUpdateForm from './WorkspaceUpdateForm.svelte';

  export let activePage: SubmissionPage;
  export let autoFillPending = false;
  export let autoFillTarget: 'create' | 'update' | null = null;
  export let createForm: CreateSubmissionFormState;
  export let createErrors: FieldErrors = {};
  export let createPending = false;
  export let createProgramSelectedId = '';
  export let deleteForm: DeleteSubmissionFormState;
  export let deleteErrors: FieldErrors = {};
  export let deletePending = false;
  export let restoreForm: RestoreSubmissionFormState;
  export let restoreErrors: FieldErrors = {};
  export let restorePending = false;
  export let restoreTarget: RestoreTargetResult | null = null;
  export let fieldNeedsRefinement: (kind: 'create' | 'update', value: string) => boolean;
  export let inputClass = '';
  export let isAutoFillMissing: (kind: 'create' | 'update', field: AutoFillFieldKey) => boolean;
  export let options: SiteSubmissionOptionsResult;
  export let optionsPending = false;
  export let queryErrors: FieldErrors = {};
  export let queryForm: QuerySubmissionFormState;
  export let queryPending = false;
  export let querySuccess: SubmissionStatusResult | null = null;
  export let resolvePending = false;
  export let searchError: string | null = null;
  export let searchPending = false;
  export let searchQuery = '';
  export let searchResults: SiteSearchItem[] = [];
  export let selectClass = '';
  export let selectChevronStyle = '';
  export let selectedSite: SiteResolveResult | null = null;
  export let statusToneClass: (status: string) => string;
  export let textAreaClass = '';
  export let updateErrors: FieldErrors = {};
  export let updateForm: UpdateSubmissionFormState;
  export let updatePending = false;
  export let updateProgramSelectedId = '';
  export let withInputStateClass: (base: string, warned: boolean, missing: boolean) => string;

  export let addFeed: (kind: 'create' | 'update') => void;
  export let applyAddressInference: (kind: 'create' | 'update') => void;
  export let clearAutoFillMissing: (kind: 'create' | 'update', field: AutoFillFieldKey) => void;
  export let removeFeed: (kind: 'create' | 'update', id: string) => void;
  export let applyProgramCustomDraft: (
    kind: 'create' | 'update',
    draft: CustomProgramDraft,
  ) => void;
  export let resolveSite: (identifier: string | SiteResolveRequest) => Promise<void>;
  export let runAutoFill: (kind: 'create' | 'update') => Promise<void>;
  export let runSearch: () => Promise<void>;
  export let selectDefaultFeed: (kind: 'create' | 'update', id: string) => void;
  export let selectProgramOption: (kind: 'create' | 'update', id: string) => void;
  export let submitCreate: () => Promise<void>;
  export let submitDelete: () => Promise<void>;
  export let submitQuery: () => Promise<void>;
  export let submitRestore: () => Promise<void>;
  export let submitUpdate: () => Promise<void>;
  export let updateCreateUrl: (value: string) => void;
  export let updateFeedName: (kind: 'create' | 'update', id: string, value: string) => void;
  export let updateFeedType: (
    kind: 'create' | 'update',
    id: string,
    value: 'RSS' | 'ATOM' | 'JSON',
  ) => void;
  export let updateFeedUrl: (kind: 'create' | 'update', id: string, value: string) => void;
  export let updateUpdateUrl: (value: string) => void;
</script>

<section
  class="order-2 rounded-md border border-(--color-line-med) p-5 sm:px-10 sm:py-8 lg:order-1"
>
  <WorkspaceHeader {activePage} />

  {#if activePage === 'create'}
    <div class="mt-6">
      <WorkspaceCreateForm
        {autoFillPending}
        {autoFillTarget}
        {submitCreate}
        {createForm}
        {createErrors}
        {createPending}
        {inputClass}
        {textAreaClass}
        {selectClass}
        {selectChevronStyle}
        {withInputStateClass}
        {isAutoFillMissing}
        {clearAutoFillMissing}
        {fieldNeedsRefinement}
        {updateCreateUrl}
        {applyAddressInference}
        {runAutoFill}
        {addFeed}
        {removeFeed}
        {updateFeedName}
        {updateFeedType}
        {updateFeedUrl}
        {selectDefaultFeed}
        {optionsPending}
        {options}
        {createProgramSelectedId}
        selectProgramForCreate={(id) => selectProgramOption('create', id)}
        applyProgramCustomDraftForCreate={(draft) => applyProgramCustomDraft('create', draft)}
        {trimText}
      />
    </div>
  {:else if activePage === 'update' || activePage === 'delete'}
    <div class="mt-6 space-y-6">
      <WorkspaceSiteResolver
        {inputClass}
        bind:searchQuery
        {searchPending}
        {resolvePending}
        {searchError}
        {searchResults}
        {selectedSite}
        {runSearch}
        {resolveSite}
      />

      {#if activePage === 'update' && selectedSite}
        <WorkspaceUpdateForm
          {autoFillPending}
          {autoFillTarget}
          {submitUpdate}
          {updateForm}
          {updateErrors}
          {updatePending}
          {inputClass}
          {textAreaClass}
          {selectClass}
          {selectChevronStyle}
          {withInputStateClass}
          {isAutoFillMissing}
          {clearAutoFillMissing}
          {fieldNeedsRefinement}
          {updateUpdateUrl}
          {applyAddressInference}
          {runAutoFill}
          {addFeed}
          {removeFeed}
          {updateFeedName}
          {updateFeedType}
          {updateFeedUrl}
          {selectDefaultFeed}
          {optionsPending}
          {options}
          {updateProgramSelectedId}
          selectProgramForUpdate={(id) => selectProgramOption('update', id)}
          applyProgramCustomDraftForUpdate={(draft) => applyProgramCustomDraft('update', draft)}
          {trimText}
        />
      {:else if activePage === 'update'}
        <section
          class="rounded-md border border-dashed border-(--color-line-med) p-5 text-sm text-(--color-fg-3)"
        >
          请先在上方搜索并选择需要修改的站点，加载后即可填写修订信息。
        </section>
      {/if}

      {#if activePage === 'delete' && selectedSite}
        <WorkspaceDeleteForm
          {submitDelete}
          {deleteForm}
          {deleteErrors}
          {deletePending}
          {inputClass}
          {textAreaClass}
        />
      {/if}
    </div>
  {:else if activePage === 'restore'}
    <div class="mt-6">
      <WorkspaceRestoreForm
        {submitRestore}
        target={restoreTarget}
        form={restoreForm}
        errors={restoreErrors}
        pending={restorePending}
        {inputClass}
        {textAreaClass}
      />
    </div>
  {:else}
    <WorkspaceQueryForm
      {inputClass}
      {queryForm}
      {queryErrors}
      {queryPending}
      {querySuccess}
      {submitQuery}
      {statusToneClass}
    />
  {/if}
</section>
