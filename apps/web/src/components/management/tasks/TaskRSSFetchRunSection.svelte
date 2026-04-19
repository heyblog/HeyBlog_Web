<script lang="ts">
  import FormMessage from '@/shared/ui/FormMessage.svelte';

  import {
    buildNetworkClass,
    buildPayloadEntries,
    buildRSSFetchSummaryEntries,
    buildRunStatusOptions,
    readRSSNetworkRegionLabel,
  } from './task-job-detail.helpers';
  import type { RSSFetchRunRecord } from './task-management.types';
  import { buildStatusClass, formatDateTime } from './task-management.types';
  import TaskDetailFieldGrid from './TaskDetailFieldGrid.svelte';
  import TaskRunPagination from './TaskRunPagination.svelte';

  let { runs }: { runs: RSSFetchRunRecord[] } = $props();

  let siteID = $state('');
  let status = $state('');
  let page = $state(1);
  let pageSize = $state(10);

  let statusOptions = $derived(buildRunStatusOptions(runs));
  let filteredRuns = $derived(
    runs.filter((row) => {
      const matchesStatus = !status || row.status === status;
      const matchesSite =
        !siteID || row.site_id.toLowerCase().includes(siteID.trim().toLowerCase());
      return matchesStatus && matchesSite;
    }),
  );
  let pagedRuns = $derived(
    filteredRuns.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
  );

  function resetPage() {
    page = 1;
  }
</script>

<section class="rounded-md border border-(--color-line) bg-(--color-bg-raised) p-5">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 class="text-base font-semibold text-(--color-fg)">RSS 抓取运行摘要</h2>
      <p class="mt-1 text-sm text-(--color-fg-3)">按站点查看抓取网络、文章数量和本次摘要。</p>
    </div>
    <p class="text-xs text-(--color-fg-3)">匹配 {filteredRuns.length} 条</p>
  </div>

  <div class="mt-4 grid gap-3 md:grid-cols-2">
    <select
      class="rounded-md border border-(--color-line) bg-(--color-bg-raised) px-3 py-2 text-sm"
      bind:value={status}
      onchange={resetPage}
    >
      <option value="">全部运行状态</option>
      {#each statusOptions as option (option)}
        <option value={option}>{option}</option>
      {/each}
    </select>

    <input
      class="rounded-md border border-(--color-line) bg-(--color-bg-raised) px-3 py-2 text-sm"
      bind:value={siteID}
      placeholder="筛选站点 ID"
      oninput={resetPage}
    />
  </div>

  {#if filteredRuns.length === 0}
    <div class="mt-4">
      <FormMessage
        tone="info"
        eyebrow="RSS FETCH"
        title="暂无匹配的抓取摘要"
        message="调整筛选条件后再查看。"
      />
    </div>
  {:else}
    <div class="mt-4 divide-y divide-(--color-line)">
      {#each pagedRuns as row (row.id)}
        <article class="py-4 first:pt-0 last:pb-0">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-medium text-(--color-fg)">{row.site_id}</h3>
                <span class={`text-sm ${buildStatusClass(row.status)}`}>{row.status}</span>
                <span class={`text-sm ${buildNetworkClass(readRSSNetworkRegionLabel(row))}`}>
                  {readRSSNetworkRegionLabel(row)}
                </span>
              </div>
              <p class="mt-2 text-xs text-(--color-fg-3)">
                开始：{formatDateTime(row.started_time)} · 完成：{formatDateTime(row.finished_time)}
              </p>
            </div>
            {#if row.error_message}
              <p class="max-w-xl text-sm text-(--color-fail)">{row.error_message}</p>
            {/if}
          </div>

          <div class="mt-4 space-y-4">
            <TaskDetailFieldGrid
              entries={buildRSSFetchSummaryEntries(row)}
              columnsClass="md:grid-cols-2 xl:grid-cols-4"
            />

            {#if buildPayloadEntries(row.summary_payload).length > 0}
              <div class="rounded-md bg-(--color-bg-raised) px-4 py-4">
                <h4 class="text-sm font-medium text-(--color-fg)">抓取摘要</h4>
                <div class="mt-3">
                  <TaskDetailFieldGrid
                    entries={buildPayloadEntries(row.summary_payload)}
                    columnsClass="grid-cols-1 md:grid-cols-2"
                  />
                </div>
              </div>
            {/if}
          </div>
        </article>
      {/each}
    </div>

    <div class="mt-4">
      <TaskRunPagination bind:page bind:pageSize total={filteredRuns.length} />
    </div>
  {/if}
</section>
