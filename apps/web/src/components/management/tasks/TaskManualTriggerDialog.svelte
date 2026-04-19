<script lang="ts">
  import ModalDialog from '@/shared/ui/ModalDialog.svelte';
  import SingleSelectCombobox from '@/shared/ui/SingleSelectCombobox.svelte';

  import type { TaskRequestConfigRecord } from './task-management.types';

  type ManualTaskKey = 'SITE_CHECK' | 'RSS_FETCH';

  let {
    open = false,
    kind = 'SITE_CHECK',
    requestConfigs = [],
    siteId = $bindable(''),
    requestConfigId = $bindable(''),
    runContentValidation = $bindable(false),
    runGlobalCheck = $bindable(false),
    feedMode = $bindable('DEFAULT_ONLY'),
    feedUrl = $bindable(''),
    busy = false,
    onCancel,
    onConfirm,
  }: {
    open?: boolean;
    kind?: ManualTaskKey;
    requestConfigs?: TaskRequestConfigRecord[];
    siteId?: string;
    requestConfigId?: string;
    runContentValidation?: boolean;
    runGlobalCheck?: boolean;
    feedMode?: string;
    feedUrl?: string;
    busy?: boolean;
    onCancel?: () => void;
    onConfirm?: () => void;
  } = $props();

  const inputClass =
    'w-full rounded-[5px] border border-(--color-line) bg-(--color-bg-raised) px-3 py-2 text-sm text-(--color-fg) outline-none transition focus:border-(--color-info)';

  let requestConfigOptions = $derived(
    requestConfigs
      .filter((item) => item.task_type === kind && item.is_enabled)
      .map((item) => ({ id: item.id, name: item.name })),
  );
</script>

<ModalDialog
  {open}
  title={kind === 'SITE_CHECK' ? '手动站点检测' : '手动 RSS 抓取'}
  description={kind === 'SITE_CHECK'
    ? '可选执行内容校验，也可以强制走全局检测。'
    : '可选抓取模式和指定 Feed URL。'}
  confirmLabel={busy ? '提交中…' : kind === 'SITE_CHECK' ? '执行检测' : '执行抓取'}
  cancelLabel="关闭"
  dismissible={!busy}
  showHeaderClose={true}
  {onCancel}
  {onConfirm}
>
  <div class="space-y-4">
    <label class="block text-sm">
      <span class="mb-1 block text-(--color-fg-3)">站点 ID</span>
      <input class={inputClass} bind:value={siteId} />
    </label>

    <div class="block text-sm">
      <span class="mb-1 block text-(--color-fg-3)">请求配置</span>
      <SingleSelectCombobox
        options={requestConfigOptions}
        selectedId={requestConfigId}
        placeholder="选择请求配置"
        onChoose={({ id }) => {
          requestConfigId = id;
        }}
      />
    </div>

    {#if kind === 'SITE_CHECK'}
      <div class="space-y-3">
        <label class="toggle-check">
          <input type="checkbox" bind:checked={runContentValidation} />
          <span class="toggle-check-box"></span>
          <span class="toggle-check-copy">
            <strong>执行内容校验</strong>
            <small>仅在站点检测结果最终为 OK 时生效。</small>
          </span>
        </label>

        <label class="toggle-check">
          <input type="checkbox" bind:checked={runGlobalCheck} />
          <span class="toggle-check-box"></span>
          <span class="toggle-check-copy">
            <strong>强制全局检测</strong>
            <small>忽略最近三次 scope 记录，直接走双地域检测。</small>
          </span>
        </label>
      </div>
    {:else}
      <label class="block text-sm">
        <span class="mb-1 block text-(--color-fg-3)">Feed 模式</span>
        <select class={inputClass} bind:value={feedMode}>
          <option value="DEFAULT_ONLY">默认订阅源</option>
          <option value="ALL">全部订阅源</option>
        </select>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block text-(--color-fg-3)">指定 Feed URL</span>
        <input class={inputClass} bind:value={feedUrl} placeholder="可选，留空时按站点配置抓取" />
      </label>
    {/if}
  </div>
</ModalDialog>
