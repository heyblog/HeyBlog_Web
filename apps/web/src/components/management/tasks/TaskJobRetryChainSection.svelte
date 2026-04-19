<script lang="ts">
  import FormMessage from '@/shared/ui/FormMessage.svelte';

  import type { TaskJobRecord } from './task-management.types';
  import { buildStatusClass, formatDateTime } from './task-management.types';

  let {
    jobs,
    currentJobId,
    returnTo,
  }: {
    jobs: TaskJobRecord[];
    currentJobId: string;
    returnTo: string;
  } = $props();
</script>

<section class="rounded-[5px] border border-(--color-line) bg-(--color-bg-raised) p-5">
  <div>
    <h2 class="text-base font-semibold text-(--color-fg)">重试链路</h2>
    <p class="mt-1 text-sm text-(--color-fg-3)">每次重试都会新建 job，旧 job 保留原状态。</p>
  </div>

  {#if jobs.length === 0}
    <div class="mt-4">
      <FormMessage
        tone="info"
        eyebrow="RETRY"
        title="暂无重试链路"
        message="当前任务没有关联的重试记录。"
      />
    </div>
  {:else}
    <div class="mt-4 divide-y divide-(--color-line)">
      {#each jobs as row (row.id)}
        <article class="py-4 first:pt-0 last:pb-0">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded-[999px] bg-[color:color-mix(in_srgb,var(--color-info)_16%,transparent)] px-2 py-0.5 text-[11px] text-(--color-info)"
                >
                  第 {row.retry_sequence ?? 0} 次
                </span>
                <span class={`text-sm ${buildStatusClass(row.status)}`}>{row.status}</span>
                {#if row.id === currentJobId}
                  <span class="text-xs text-(--color-fg-3)">当前</span>
                {/if}
              </div>
              <p class="mt-2 text-sm text-(--color-fg-2)">{row.id}</p>
              <p class="mt-1 text-xs text-(--color-fg-3)">
                创建：{formatDateTime(row.created_time)} · 开始：{formatDateTime(row.started_time)} ·
                完成：{formatDateTime(row.finished_time)}
              </p>
              <p class="mt-1 text-xs text-(--color-fg-3)">
                根任务：{row.retry_root_job_id ?? row.id} · 上级任务：{row.retry_parent_job_id ??
                  '—'}
              </p>
            </div>

            {#if row.id !== currentJobId}
              <a
                class="rounded-[5px] border border-(--color-line-med) px-3 py-1.5 text-sm"
                href={`/management/tasks/jobs/${row.id}?return_to=${encodeURIComponent(returnTo)}`}
              >
                查看
              </a>
            {/if}
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>
