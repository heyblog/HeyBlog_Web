<script lang="ts">
  import type {
    SiteSnapshotDraft,
    SiteSubmissionOptions,
  } from '@/application/management/site-management.snapshot';

  import ManagementSiteArchitectureSection from './ManagementSiteArchitectureSection.svelte';
  import ManagementSiteBasicSection from './ManagementSiteBasicSection.svelte';
  import ManagementSiteFeedSection from './ManagementSiteFeedSection.svelte';

  export let draft: SiteSnapshotDraft;
  export let options: SiteSubmissionOptions;
  export let disabled = false;
  export let idPrefix = 'site-management-fields';
  export let fieldAlerts: Partial<Record<string, { label: string; value: string }>> = {};
</script>

<div class="space-y-6">
  <ManagementSiteBasicSection bind:draft {options} {disabled} {idPrefix} {fieldAlerts} />
  <ManagementSiteFeedSection bind:draft {disabled} {idPrefix} {fieldAlerts} />
  <ManagementSiteArchitectureSection bind:draft {options} {disabled} {idPrefix} {fieldAlerts} />
</div>
