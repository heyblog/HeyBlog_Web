<script lang="ts">
  import ModalDialog from '@/shared/ui/ModalDialog.svelte';
  import SingleSelectCombobox from '@/shared/ui/SingleSelectCombobox.svelte';

  import type { RequestConfigFormState, TaskCatalog } from './task-management.types';
  import { formatCatalogOption } from './task-management.types';
  import { appendHeaderRow, removeHeaderRow } from './task-request-config.helpers';

  let {
    open = false,
    catalog,
    form = $bindable(),
    busy = false,
    onCancel,
    onConfirm,
  }: {
    open?: boolean;
    catalog: TaskCatalog;
    form: RequestConfigFormState;
    busy?: boolean;
    onCancel?: () => void;
    onConfirm?: () => void;
  } = $props();

  const inputClass =
    'w-full rounded-md border border-(--color-line) bg-(--color-bg-raised) px-3 py-2 text-sm text-(--color-fg) outline-none transition focus:border-(--color-info)';

  let taskTypeOptions = $derived(
    catalog.task_types.map((item) => ({ id: item.key, name: formatCatalogOption(item) })),
  );
  let retryStrategyOptions = $derived(
    catalog.request_retry_strategies.map((item) => ({
      id: item.key,
      name: formatCatalogOption(item),
    })),
  );
  let selectedRetryStrategy = $derived(form.retryStrategy || 'EXPONENTIAL');
  let showRetryFields = $derived(Number.parseInt(form.retryMax.trim() || '0', 10) > 0);
  let retryStrategyDescription = $derived.by(() => {
    const selected = catalog.request_retry_strategies.find(
      (item) => item.key === selectedRetryStrategy,
    );
    return selected?.description ?? '';
  });
  let retryBaseDelayLabel = $derived(
    selectedRetryStrategy === 'FIXED' ? '固定延迟（毫秒）' : '基础延迟（毫秒）',
  );
  let showBackoffFactor = $derived(selectedRetryStrategy === 'EXPONENTIAL');
</script>

<ModalDialog
  {open}
  panelClass="!w-[min(52rem,calc(100vw-1.5rem))]"
  title={form.id ? '编辑请求配置' : '新建请求配置'}
  description="统一维护单次上游抓取、站点检测和 RSS 抓取的请求参数。"
  confirmLabel={busy ? '保存中…' : form.id ? '保存配置' : '创建配置'}
  cancelLabel="关闭"
  dismissible={!busy}
  showHeaderClose={true}
  {onCancel}
  {onConfirm}
>
  <div class="space-y-5">
    <section class="space-y-4">
      <div>
        <h3 class="text-sm font-semibold text-(--color-fg)">基础信息</h3>
        <p class="mt-1 text-xs text-(--color-fg-3)">按任务类型建立独立的请求配置，避免混用。</p>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="block text-sm md:col-span-2">
          <span class="mb-1 block text-(--color-fg-3)">名称</span>
          <input class={inputClass} bind:value={form.name} />
        </label>

        <div class="block text-sm">
          <span class="mb-1 block text-(--color-fg-3)">任务类型</span>
          <SingleSelectCombobox
            options={taskTypeOptions}
            selectedId={form.taskType}
            placeholder="选择任务类型"
            onChoose={({ id }) => {
              form.taskType = id;
            }}
          />
        </div>

        <label class="block text-sm">
          <span class="mb-1 block text-(--color-fg-3)">User-Agent</span>
          <input class={inputClass} bind:value={form.userAgent} />
        </label>
      </div>
    </section>

    <section class="space-y-4">
      <div>
        <h3 class="text-sm font-semibold text-(--color-fg)">请求行为</h3>
        <p class="mt-1 text-xs text-(--color-fg-3)">超时、重定向和请求间隔都在这里调整。</p>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <label class="block text-sm">
          <span class="mb-1 block text-(--color-fg-3)">超时（毫秒）</span>
          <input class={inputClass} bind:value={form.timeoutMs} />
        </label>

        <label class="block text-sm">
          <span class="mb-1 block text-(--color-fg-3)">请求间隔（毫秒）</span>
          <input class={inputClass} bind:value={form.waitBetweenRequestsMs} />
        </label>

        <label class="toggle-check">
          <input type="checkbox" bind:checked={form.followRedirects} />
          <span class="toggle-check-box"></span>
          <span class="toggle-check-copy">
            <strong>跟随重定向</strong>
            <small>关闭后保留原始跳转响应。</small>
          </span>
        </label>
      </div>
    </section>

    <section class="space-y-4">
      <div>
        <h3 class="text-sm font-semibold text-(--color-fg)">重试策略</h3>
        <p class="mt-1 text-xs text-(--color-fg-3)">
          这里只控制单次请求的重试，不控制 job 级重试。
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <label class="block text-sm">
          <span class="mb-1 block text-(--color-fg-3)">重试次数</span>
          <input class={inputClass} bind:value={form.retryMax} />
        </label>

        <div class="block text-sm">
          <span class="mb-1 block text-(--color-fg-3)">重试策略</span>
          <SingleSelectCombobox
            options={retryStrategyOptions}
            selectedId={form.retryStrategy}
            placeholder="选择重试策略"
            onChoose={({ id }) => {
              form.retryStrategy = id;
            }}
          />
        </div>
      </div>

      {#if showRetryFields}
        <div class="space-y-3 border-t border-(--color-line) pt-4">
          <p class="text-xs text-(--color-fg-3)">
            {retryStrategyDescription || '当前策略下只展示实际会生效的参数。'}
          </p>
          <div class="grid gap-4 md:grid-cols-3">
            <label class="block text-sm">
              <span class="mb-1 block text-(--color-fg-3)">{retryBaseDelayLabel}</span>
              <input class={inputClass} bind:value={form.retryBaseDelayMs} />
            </label>

            <label class="block text-sm">
              <span class="mb-1 block text-(--color-fg-3)">最大延迟（毫秒）</span>
              <input class={inputClass} bind:value={form.retryMaxDelayMs} />
            </label>

            <label class="block text-sm">
              <span class="mb-1 block text-(--color-fg-3)">抖动比例（%）</span>
              <input class={inputClass} bind:value={form.jitterRatio} />
            </label>

            {#if showBackoffFactor}
              <label class="block text-sm">
                <span class="mb-1 block text-(--color-fg-3)">退避系数</span>
                <input class={inputClass} bind:value={form.backoffFactor} />
              </label>
            {/if}
          </div>
        </div>
      {:else}
        <p class="border-t border-(--color-line) pt-4 text-xs text-(--color-fg-3)">
          当前不执行请求级重试。
        </p>
      {/if}
    </section>

    <section class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-(--color-fg)">默认请求头</h3>
          <p class="mt-1 text-xs text-(--color-fg-3)">按键值对维护，不展示 JSON。</p>
        </div>
        <button
          class="rounded-md border border-(--color-line-med) px-3 py-1.5 text-sm"
          type="button"
          onclick={() => {
            form.headerRows = appendHeaderRow(form.headerRows);
          }}
        >
          新增请求头
        </button>
      </div>

      <div class="space-y-3">
        {#each form.headerRows as row, index (index)}
          <div class="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input class={inputClass} placeholder="Header 名称" bind:value={row.key} />
            <input class={inputClass} placeholder="Header 值" bind:value={row.value} />
            <button
              class="rounded-md border border-(--color-line-med) px-3 py-2 text-sm"
              type="button"
              onclick={() => {
                form.headerRows = removeHeaderRow(form.headerRows, index);
              }}
            >
              删除
            </button>
          </div>
        {/each}
      </div>

      <label class="toggle-check">
        <input type="checkbox" bind:checked={form.isEnabled} />
        <span class="toggle-check-box"></span>
        <span class="toggle-check-copy">
          <strong>保存后启用</strong>
          <small>停用后不会在表单里继续作为可选配置出现。</small>
        </span>
      </label>
    </section>
  </div>
</ModalDialog>
