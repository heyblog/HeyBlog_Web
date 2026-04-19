<script lang="ts">
  import FormMessage from '@/shared/ui/FormMessage.svelte';
  import Tooltip from '@/shared/ui/Tooltip.svelte';

  import { buildJobResultSummary, buildTaskTargetSummary } from './task-management.helpers';
  import type { JobFilterState, TaskCatalog, TaskJobRecord } from './task-management.types';
  import {
    buildStatusClass,
    formatCatalogOption,
    formatDateTime,
    isJobCancelRequested,
  } from './task-management.types';

  let {
    catalog,
    jobs,
    filters = $bindable(),
    returnTo = '/management/tasks?panel=jobs',
    onCancel,
    onDelete,
    onRetry,
    onRefresh,
    onResetFilters,
  }: {
    catalog: TaskCatalog;
    jobs: TaskJobRecord[];
    filters: JobFilterState;
    returnTo?: string;
    onCancel?: (job: TaskJobRecord) => void;
    onDelete?: (job: TaskJobRecord) => void;
    onRetry?: (jobId: string) => void;
    onRefresh?: () => void;
    onResetFilters?: () => void;
  } = $props();

  const inputClass =
    'w-full rounded-[5px] border border-(--color-line) bg-(--color-bg-raised) px-3 py-2 text-sm text-(--color-fg) outline-none transition focus:border-(--color-info)';
</script>

<section class="space-y-4 rounded-[5px] border border-(--color-line) bg-(--color-bg-raised) p-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="text-base font-semibold text-(--color-fg)">任务实例</h2>
      <p class="mt-1 text-sm text-(--color-fg-3)">
        筛选当前 job，进入详情后继续保留当前查询上下文。
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button
        class="rounded-[5px] border border-(--color-line-med) px-4 py-2 text-sm"
        type="button"
        onclick={onResetFilters}>清空筛选</button
      >
      <button
        class="rounded-[5px] border border-(--color-line-med) px-4 py-2 text-sm"
        type="button"
        onclick={onRefresh}>应用筛选</button
      >
    </div>
  </div>

  <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    <select class={inputClass} bind:value={filters.status}>
      <option value="">全部状态</option>
      {#each catalog.job_statuses as item (item.key)}
        <option value={item.key}>{formatCatalogOption(item)}</option>
      {/each}
    </select>

    <select class={inputClass} bind:value={filters.task_type}>
      <option value="">全部任务</option>
      {#each catalog.task_types as item (item.key)}
        <option value={item.key}>{formatCatalogOption(item)}</option>
      {/each}
    </select>

    <select class={inputClass} bind:value={filters.trigger_source}>
      <option value="">全部来源</option>
      {#each catalog.trigger_sources as item (item.key)}
        <option value={item.key}>{formatCatalogOption(item)}</option>
      {/each}
    </select>

    <input class={inputClass} placeholder="site_id" bind:value={filters.site_id} />
    <input class={inputClass} placeholder="创建开始时间" bind:value={filters.created_from} />
    <input class={inputClass} placeholder="创建结束时间" bind:value={filters.created_to} />
  </div>

  {#if jobs.length === 0}
    <FormMessage
      tone="info"
      eyebrow="JOBS"
      title="暂无匹配的任务实例"
      message="可以切换筛选条件后刷新，或先从手动触发、调度定义创建新的 job。"
    />
  {:else}
    <div class="divide-y divide-(--color-line)">
      {#each jobs as row (row.id)}
        <article class="py-4 first:pt-0 last:pb-0">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-medium text-(--color-fg)">{row.task_type}</h3>
                <span class={`text-sm ${buildStatusClass(row.status)}`}>{row.status}</span>
              </div>
              <p class="mt-2 text-sm text-(--color-fg-3)">{buildTaskTargetSummary(row.payload)}</p>
              <p class="mt-1 text-xs text-(--color-fg-3)">
                {buildJobResultSummary(row) || '尚未生成任务摘要'}
              </p>
              <p class="mt-1 text-xs text-(--color-fg-3)">
                重试链路：第 {row.retry_sequence ?? 0} 次
                {row.retry_root_job_id ? ` · 根任务 ${row.retry_root_job_id}` : ''}
              </p>
              <p class="mt-2 text-xs text-(--color-fg-3)">
                创建：{formatDateTime(row.created_time)} · 开始：{formatDateTime(row.started_time)} ·
                完成：{formatDateTime(row.finished_time)}
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <a
                class="rounded-[5px] border border-(--color-line-med) px-3 py-1.5 text-sm"
                href={`/management/tasks/jobs/${row.id}?return_to=${encodeURIComponent(returnTo)}`}
              >
                详情
              </a>

              {#if row.status === 'FAILED' || row.status === 'CANCELED'}
                <Tooltip content="重试会新建一个 job，旧 job 保持原状态" placement="bottom">
                  <button
                    class="rounded-[5px] border border-(--color-line-med) px-3 py-1.5 text-sm"
                    type="button"
                    onclick={() => onRetry?.(row.id)}
                  >
                    重试
                  </button>
                </Tooltip>
              {/if}

              {#if row.status === 'PENDING' || (row.status === 'RUNNING' && !isJobCancelRequested(row))}
                <Tooltip
                  content={row.status === 'RUNNING'
                    ? '运行中任务会先发起协商取消，待 worker 停止后再落为已取消'
                    : '待执行任务会立即取消，不再进入 worker'}
                  placement="bottom"
                >
                  <button
                    class="rounded-[5px] border border-(--color-line-med) px-3 py-1.5 text-sm"
                    type="button"
                    onclick={() => onCancel?.(row)}
                  >
                    取消
                  </button>
                </Tooltip>
              {/if}

              {#if row.status === 'SUCCEEDED' || row.status === 'FAILED' || row.status === 'CANCELED'}
                <Tooltip content="只删除当前 job 记录，不影响已有运行摘要" placement="bottom">
                  <button
                    class="rounded-[5px] border border-(--color-line-med) px-3 py-1.5 text-sm"
                    type="button"
                    onclick={() => onDelete?.(row)}
                  >
                    删除
                  </button>
                </Tooltip>
              {/if}
            </div>
          </div>

          {#if isJobCancelRequested(row)}
            <p class="mt-3 text-sm text-(--color-warn)">
              已发取消请求，等待 worker 协商停止当前任务。
            </p>
          {:else if row.error_message}
            <p class="mt-3 text-sm text-(--color-fail)">{row.error_message}</p>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</section>
