<script lang="ts">
  import FormMessage from '@/shared/ui/FormMessage.svelte';

  import type { TaskCatalog } from './task-management.types';

  type ManualTaskKey = 'SITE_CHECK' | 'RSS_FETCH';

  let {
    catalog,
    onOpen,
  }: {
    catalog: TaskCatalog;
    onOpen?: (kind: ManualTaskKey) => void;
  } = $props();

  const cards: Array<{
    kind: ManualTaskKey;
    title: string;
    description: string;
  }> = [
    {
      kind: 'SITE_CHECK',
      title: '站点检测',
      description: '用于站点审核、修改后复查或故障回放，默认写入本次检测摘要。',
    },
    {
      kind: 'RSS_FETCH',
      title: 'RSS 抓取',
      description: '用于单站点补抓、Feed 回放或站点新增后的首次抓取。',
    },
  ];
</script>

<section class="space-y-4 rounded-[5px] border border-(--color-line) bg-(--color-bg-raised) p-5">
  <div>
    <h2 class="text-base font-semibold text-(--color-fg)">手动触发</h2>
    <p class="mt-1 text-sm text-(--color-fg-3)">
      手动建单统一落到当前 job 列表，可直接跳转到运行详情追踪。
    </p>
  </div>

  <FormMessage
    tone="info"
    eyebrow="MANUAL"
    title="使用说明"
    message="手动触发不会拆分出额外任务类型，站点检测和 RSS 抓取都沿用统一的 target 协议。"
  />

  <div class="grid gap-4 lg:grid-cols-2">
    {#each cards as card (card.kind)}
      <article class="rounded-[5px] bg-(--color-bg-raised) p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-sm font-medium text-(--color-fg)">{card.title}</h3>
            <p class="mt-2 text-sm leading-6 text-(--color-fg-3)">{card.description}</p>
            <p class="mt-2 text-xs text-(--color-fg-3)">
              {catalog.presets.manual.find((item) => item.task_type === card.kind)?.name ??
                card.title}
            </p>
          </div>
          <button
            class="shrink-0 rounded-[5px] border border-(--color-line-med) px-3 py-1.5 text-sm text-(--color-fg-2) transition hover:border-(--color-line) hover:bg-(--color-bg) hover:text-(--color-fg)"
            type="button"
            onclick={() => onOpen?.(card.kind)}
          >
            打开
          </button>
        </div>
      </article>
    {/each}
  </div>
</section>
