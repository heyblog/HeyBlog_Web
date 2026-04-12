<script lang="ts">
  import { type CustomProgramDraft } from '@/application/site-submission/site-submission.browser-form';
  import type { AutoFillFieldKey } from '@/application/site-submission/site-submission.browser-workspace';
  import type {
    FeedType,
    FieldErrors,
    SiteSubmissionOptionsResult,
  } from '@/application/site-submission/site-submission.service';

  import type { CommonSiteForm, FeedTypeOption } from './site-editable-fields.types';
  import SiteEditableArchitectureSection from './SiteEditableArchitectureSection.svelte';
  import SiteEditableBasicSection from './SiteEditableBasicSection.svelte';
  import SiteEditableFeedSection from './SiteEditableFeedSection.svelte';

  const noop = (): void => {};
  const returnFalse = (): boolean => false;

  export const mode: 'create' | 'update' | 'management' = 'update';
  export let form: CommonSiteForm;
  export let errors: FieldErrors = {};
  export let options: SiteSubmissionOptionsResult;
  export let optionsPending = false;
  export let disabled = false;
  export let idPrefix = 'site-fields';
  export let inputClass = '';
  export let textAreaClass = '';
  export let selectClass = '';
  export let selectChevronStyle = '';
  export let selectedProgramId = '';
  export let allowFeedTypeSelect = false;
  export let feedTypeOptions: FeedTypeOption[] = [];
  export let withInputStateClass: (base: string, warned: boolean, missing: boolean) => string = (
    base,
  ) => base;
  export let isAutoFillMissing: (field: AutoFillFieldKey) => boolean = returnFalse;
  export let clearAutoFillMissing: (field: AutoFillFieldKey) => void = noop;
  export let fieldNeedsRefinement: (value: string) => boolean = returnFalse;
  export let updateUrl: ((value: string) => void) | undefined = undefined;
  export let applyAddressInference: (() => void) | undefined = undefined;
  export let runAutoFill: (() => Promise<void> | void) | undefined = undefined;
  export let addFeed: (() => void) | undefined = undefined;
  export let removeFeed: ((id: string) => void) | undefined = undefined;
  export let updateFeedName: ((id: string, value: string) => void) | undefined = undefined;
  export let updateFeedUrl: ((id: string, value: string) => void) | undefined = undefined;
  export let selectDefaultFeed: ((id: string) => void) | undefined = undefined;
  export let updateFeedType: ((id: string, value: FeedType) => void) | undefined = undefined;
  export let selectProgram: ((id: string) => void) | undefined = undefined;
  export let applyProgramCustomDraft: ((draft: CustomProgramDraft) => void) | undefined = undefined;
  export let trimText: (value: string) => string = (value) => value.trim();
</script>

<div class="space-y-6">
  <SiteEditableBasicSection
    bind:form
    {errors}
    {options}
    {optionsPending}
    {disabled}
    {idPrefix}
    {inputClass}
    {textAreaClass}
    {selectClass}
    {selectChevronStyle}
    {withInputStateClass}
    {isAutoFillMissing}
    {clearAutoFillMissing}
    {updateUrl}
    {applyAddressInference}
    {runAutoFill}
  />

  <SiteEditableFeedSection
    bind:form
    {errors}
    {disabled}
    {idPrefix}
    {inputClass}
    {selectClass}
    {selectChevronStyle}
    {allowFeedTypeSelect}
    {feedTypeOptions}
    {withInputStateClass}
    {fieldNeedsRefinement}
    {isAutoFillMissing}
    {clearAutoFillMissing}
    {addFeed}
    {removeFeed}
    {updateFeedName}
    {updateFeedUrl}
    {selectDefaultFeed}
    {updateFeedType}
  />

  <SiteEditableArchitectureSection
    bind:form
    {errors}
    {options}
    {optionsPending}
    {disabled}
    {idPrefix}
    {selectedProgramId}
    {isAutoFillMissing}
    {selectProgram}
    {applyProgramCustomDraft}
    {trimText}
  />
</div>
