<script lang="ts">
  import FormMessage from '@/shared/ui/FormMessage.svelte';

  import { buildPayloadEntries, buildUpstreamSyncSummaryEntries } from './task-job-detail.helpers';
  import type { UpstreamSyncRunRecord } from './task-management.types';
  import { formatDateTime } from './task-management.types';
  import TaskDetailFieldGrid from './TaskDetailFieldGrid.svelte';
  import TaskRunPagination from './TaskRunPagination.svelte';

  let { runs }: { runs: UpstreamSyncRunRecord[] } = $props();

  let page = $state(1);
  let pageSize = $state(10);
  let pagedRuns = $derived(runs.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize));
</script>

<section class="rounded-md border border-(--color-line) bg-(--color-bg-raised) p-5">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 class="text-base font-semibold text-(--color-fg)">上游同步运行摘要</h2>
      <p class="mt-1 text-sm text-(--color-fg-3)">按上游源查看同步计数和摘要。</p>
    </div>
    <p class="text-xs text-(--color-fg-3)">共 {runs.length} 条</p>
  </div>

  {#if runs.length === 0}
    <div class="mt-4">
      <FormMessage
        tone="info"
        eyebrow="UPSTREAM"
        title="暂无同步摘要"
        message="当前任务还没有产生上游同步结果。"
      />
    </div>
  {:else}
    <div class="mt-4 divide-y divide-(--color-line)">
      {#each pagedRuns as row (row.id)}
        <article class="py-4 first:pt-0 last:pb-0">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-medium text-(--color-fg)">{row.source_id}</h3>
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
              entries={buildUpstreamSyncSummaryEntries(row)}
              columnsClass="md:grid-cols-2 xl:grid-cols-4"
            />

            {#if buildPayloadEntries(row.summary_payload).length > 0}
              <div class="rounded-md bg-(--color-bg-raised) px-4 py-4">
                <h4 class="text-sm font-medium text-(--color-fg)">同步摘要</h4>
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
      <TaskRunPagination bind:page bind:pageSize total={runs.length} />
    </div>
  {/if}
</section>
