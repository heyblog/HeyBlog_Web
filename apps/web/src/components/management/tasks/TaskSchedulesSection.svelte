<script lang="ts">
  import FormMessage from '@/shared/ui/FormMessage.svelte';

  import { buildScheduleMetaSummary, buildScheduleOptionSummary } from './task-management.helpers';
  import type { TaskRequestConfigRecord, TaskScheduleRecord } from './task-management.types';
  import { formatDateTime } from './task-management.types';

  let {
    requestConfigs,
    schedules,
    busy = false,
    onCreate,
    onEdit,
    onRun,
    onToggle,
  }: {
    requestConfigs: TaskRequestConfigRecord[];
    schedules: TaskScheduleRecord[];
    busy?: boolean;
    onCreate?: () => void;
    onEdit?: (schedule: TaskScheduleRecord) => void;
    onRun?: (scheduleId: string) => void;
    onToggle?: (scheduleId: string) => void;
  } = $props();
</script>

<section class="space-y-4 rounded-md border border-(--color-line) bg-(--color-bg-raised) p-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="text-base font-semibold text-(--color-fg)">调度定义</h2>
      <p class="mt-1 text-sm text-(--color-fg-3)">
        统一维护定时建单模板、启停状态与单次立即执行入口。
      </p>
    </div>
    <button
      class="rounded-md border border-(--color-line-med) px-4 py-2 text-sm text-(--color-fg-2) transition hover:border-(--color-line) hover:bg-(--color-bg-raised) hover:text-(--color-fg)"
      type="button"
      onclick={onCreate}
    >
      新建调度
    </button>
  </div>

  {#if schedules.length === 0}
    <FormMessage
      tone="info"
      eyebrow="SCHEDULES"
      title="暂无调度"
      message="当前还没有保存任何调度，可从新建调度模态框里直接套用模板。"
    />
  {:else}
    <div class="divide-y divide-(--color-line)">
      {#each schedules as row (row.id)}
        <article class="py-4 first:pt-0 last:pb-0">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-medium text-(--color-fg)">{row.name}</h3>
                <span
                  class={`rounded-[999px] px-2 py-0.5 text-[11px] ${
                    row.is_enabled
                      ? 'bg-[color-mix(in_srgb,var(--color-ok)_16%,transparent)] text-(--color-ok)'
                      : 'bg-[color-mix(in_srgb,var(--color-line)_72%,transparent)] text-(--color-fg-3)'
                  }`}
                >
                  {row.is_enabled ? '已启用' : '已停用'}
                </span>
              </div>
              <p class="mt-2 text-sm text-(--color-fg-3)">
                {buildScheduleMetaSummary(row, requestConfigs)}
              </p>
              {#if buildScheduleOptionSummary(row)}
                <p class="mt-1 text-xs text-(--color-fg-3)">{buildScheduleOptionSummary(row)}</p>
              {/if}
              <p class="mt-2 text-xs text-(--color-fg-3)">
                下次执行：{formatDateTime(row.next_run_time)} · 最近执行：{formatDateTime(
                  row.last_run_time,
                )}
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                class="rounded-md border border-(--color-line-med) px-3 py-1.5 text-sm"
                type="button"
                onclick={() => onEdit?.(row)}>编辑</button
              >
              <button
                class="rounded-md border border-(--color-line-med) px-3 py-1.5 text-sm"
                type="button"
                onclick={() => onToggle?.(row.id)}
              >
                {row.is_enabled ? '停用' : '启用'}
              </button>
              <button
                class="rounded-md border border-(--color-line-med) px-3 py-1.5 text-sm"
                type="button"
                disabled={busy}
                onclick={() => onRun?.(row.id)}
              >
                立即执行
              </button>
            </div>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>
