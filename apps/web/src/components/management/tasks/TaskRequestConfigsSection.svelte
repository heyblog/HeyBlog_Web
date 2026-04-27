<script lang="ts">
  import ConfirmDialog from '@/shared/ui/ConfirmDialog.svelte';
  import FormMessage from '@/shared/ui/FormMessage.svelte';

  import type { TaskRequestConfigRecord } from './task-management.types';
  import { formatDateTime } from './task-management.types';

  let {
    requestConfigs,
    busy = false,
    onCreate,
    onEdit,
    onToggle,
    onDelete,
  }: {
    requestConfigs: TaskRequestConfigRecord[];
    busy?: boolean;
    onCreate?: () => void;
    onEdit?: (config: TaskRequestConfigRecord) => void;
    onToggle?: (configId: string) => void;
    onDelete?: (configId: string) => void;
  } = $props();

  let pendingDeleteId = $state<string | null>(null);
</script>

<section class="space-y-4 rounded-md border border-(--color-line) bg-(--color-bg-raised) p-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="text-base font-semibold text-(--color-fg)">请求配置</h2>
      <p class="mt-1 text-sm text-(--color-fg-3)">统一管理 UA、超时、重试和默认请求头。</p>
    </div>
    <button
      class="rounded-md border border-(--color-line-med) px-4 py-2 text-sm"
      type="button"
      onclick={onCreate}
    >
      新建请求配置
    </button>
  </div>

  {#if requestConfigs.length === 0}
    <FormMessage
      tone="info"
      eyebrow="REQUEST CONFIGS"
      title="暂无请求配置"
      message="先创建请求配置，再把它绑定到调度或手动执行表单。"
    />
  {:else}
    <div class="divide-y divide-(--color-line)">
      {#each requestConfigs as row (row.id)}
        <article class="py-4 first:pt-0 last:pb-0">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-medium text-(--color-fg)">{row.name}</h3>
                <span class="text-xs text-(--color-fg-3)">{row.task_type}</span>
                <span
                  class={`rounded-full px-2 py-0.5 text-[11px] ${
                    row.is_enabled
                      ? 'bg-[color-mix(in_srgb,var(--color-ok)_16%,transparent)] text-(--color-ok)'
                      : 'bg-[color-mix(in_srgb,var(--color-line)_72%,transparent)] text-(--color-fg-3)'
                  }`}
                >
                  {row.is_enabled ? '已启用' : '已停用'}
                </span>
              </div>
              <p class="mt-2 text-sm text-(--color-fg-3)">
                UA：{row.user_agent} · 超时：{row.timeout_ms}ms · 重试：{row.retry_max} 次
              </p>
              <p class="mt-1 text-xs text-(--color-fg-3)">
                更新时间：{formatDateTime(row.updated_time)}
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
                disabled={busy}
                onclick={() => onToggle?.(row.id)}
              >
                {row.is_enabled ? '停用' : '启用'}
              </button>
              <button
                class="rounded-md border border-(--color-line-med) px-3 py-1.5 text-sm text-(--color-fail)"
                type="button"
                onclick={() => {
                  pendingDeleteId = row.id;
                }}
              >
                删除
              </button>
            </div>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>

<ConfirmDialog
  open={pendingDeleteId !== null}
  title="确认删除请求配置"
  description="已绑定的调度或运行记录会阻止删除。"
  confirmLabel={busy ? '处理中…' : '确认删除'}
  cancelLabel="取消"
  dismissible={!busy}
  onCancel={() => {
    if (!busy) pendingDeleteId = null;
  }}
  onConfirm={() => {
    if (pendingDeleteId) {
      onDelete?.(pendingDeleteId);
      pendingDeleteId = null;
    }
  }}
/>
