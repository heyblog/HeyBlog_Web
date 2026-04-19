<script lang="ts">
  import type { TaskDetailEntry, TaskProgressSummary } from './task-job-detail.helpers';
  import TaskDetailFieldGrid from './TaskDetailFieldGrid.svelte';

  let {
    summary = null,
    entries = [],
  }: {
    summary?: TaskProgressSummary | null;
    entries?: TaskDetailEntry[];
  } = $props();

  let metricItems = $derived(
    summary
      ? [
          { label: '总数', value: summary.total, tone: 'text-(--color-fg)' },
          { label: summary.processedLabel, value: summary.processed, tone: 'text-(--color-info)' },
          { label: summary.pendingLabel, value: summary.pending, tone: 'text-(--color-fg-2)' },
          { label: '失败', value: summary.failed, tone: 'text-(--color-fail)' },
          { label: '跳过', value: summary.skipped, tone: 'text-(--color-warn)' },
        ]
      : [],
  );
</script>

<section class="rounded-[5px] border border-(--color-line) bg-(--color-bg-raised) p-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="text-base font-semibold text-(--color-fg)">任务摘要</h2>
      {#if summary}
        <p class="mt-1 text-sm text-(--color-fg-3)">{summary.title}</p>
      {/if}
    </div>
    {#if summary}
      <span class="text-sm text-(--color-fg-3)">{summary.ratio}%</span>
    {/if}
  </div>

  {#if summary}
    <div
      class="mt-3 h-2 overflow-hidden rounded-[5px] bg-[color:color-mix(in_srgb,var(--color-line)_72%,transparent)]"
    >
      <div
        class="h-full rounded-[5px] bg-(--color-info) transition-[width]"
        style={`width:${summary.ratio}%`}
      ></div>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-5">
      {#each metricItems as item (item.label)}
        <div class="rounded-[5px] bg-(--color-bg-raised) px-3 py-3">
          <p class="text-xs text-(--color-fg-3)">{item.label}</p>
          <p class={`mt-1 text-sm font-medium ${item.tone}`}>{item.value}</p>
        </div>
      {/each}
    </div>
  {/if}

  {#if entries.length > 0}
    <div class="mt-4">
      <TaskDetailFieldGrid {entries} columnsClass="md:grid-cols-2 xl:grid-cols-3" />
    </div>
  {/if}
</section>
