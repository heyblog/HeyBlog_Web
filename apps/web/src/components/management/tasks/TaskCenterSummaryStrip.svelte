<script lang="ts">
  import type { TaskJobRecord, TaskScheduleRecord } from './task-management.types';

  let {
    schedules,
    jobs,
    requestConfigCount = 0,
  }: {
    schedules: TaskScheduleRecord[];
    jobs: TaskJobRecord[];
    requestConfigCount?: number;
  } = $props();

  const cards = $derived([
    { label: '调度总数', value: schedules.length, tone: 'text-(--color-fg)' },
    {
      label: '请求配置',
      value: requestConfigCount,
      tone: 'text-(--color-info)',
    },
    {
      label: '待执行',
      value: jobs.filter((item) => item.status === 'PENDING').length,
      tone: 'text-(--color-ok)',
    },
    {
      label: '运行中',
      value: jobs.filter((item) => item.status === 'RUNNING').length,
      tone: 'text-(--color-warn)',
    },
  ]);
</script>

<section class="rounded-[5px] border border-(--color-line) bg-(--color-bg-raised) p-5">
  <div>
    <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-(--color-info)">TASK CENTER</p>
    <h1 class="mt-2 text-[20px] font-medium text-(--color-fg)">后台任务中心</h1>
    <p class="mt-2 text-sm leading-6 text-(--color-fg-3)">
      使用选项卡切换调度定义、请求配置、手动执行和作业记录，当前页只保留一个入口层级。
    </p>
  </div>

  <div class="mt-4 grid gap-3 md:grid-cols-4">
    {#each cards as card (card.label)}
      <article class="rounded-[5px] bg-(--color-bg-raised) px-4 py-4">
        <p class="text-xs text-(--color-fg-3)">{card.label}</p>
        <p class={`mt-2 text-lg font-medium ${card.tone}`}>{card.value}</p>
      </article>
    {/each}
  </div>
</section>
