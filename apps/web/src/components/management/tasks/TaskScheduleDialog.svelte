<script lang="ts">
  import ModalDialog from '@/shared/ui/ModalDialog.svelte';
  import SingleSelectCombobox from '@/shared/ui/SingleSelectCombobox.svelte';

  import type {
    ScheduleFormState,
    TaskCatalog,
    TaskRequestConfigRecord,
  } from './task-management.types';
  import { formatCatalogOption } from './task-management.types';

  let {
    open = false,
    catalog,
    requestConfigs = [],
    form = $bindable(),
    busy = false,
    onCancel,
    onConfirm,
  }: {
    open?: boolean;
    catalog: TaskCatalog;
    requestConfigs?: TaskRequestConfigRecord[];
    form: ScheduleFormState;
    busy?: boolean;
    onCancel?: () => void;
    onConfirm?: () => void;
  } = $props();

  const inputClass =
    'w-full rounded-md border border-(--color-line) bg-(--color-bg-raised) px-3 py-2 text-sm text-(--color-fg) outline-none transition focus:border-(--color-info)';
  const textareaClass = `${inputClass} min-h-24 resize-y`;

  let taskTypeOptions = $derived(
    catalog.task_types.map((item) => ({ id: item.key, name: formatCatalogOption(item) })),
  );
  let requestConfigOptions = $derived(
    requestConfigs
      .filter((item) => item.task_type === form.taskType && item.is_enabled)
      .map((item) => ({ id: item.id, name: item.name })),
  );
  let isUpstreamTask = $derived(form.taskType === 'UPSTREAM_SYNC');
  let isSiteCheckTask = $derived(form.taskType === 'SITE_CHECK');
  let isRSSFetchTask = $derived(form.taskType === 'RSS_FETCH');
  let isCronMode = $derived(form.scheduleMode === 'CRON');
</script>

<ModalDialog
  {open}
  panelClass="!w-[min(52rem,calc(100vw-1.5rem))]"
  title={form.id ? '编辑调度' : '新建调度'}
  description="调度只负责频率、目标范围和绑定请求配置，不再承载单次请求参数。"
  confirmLabel={busy ? '保存中…' : form.id ? '保存调度' : '创建调度'}
  cancelLabel="关闭"
  dismissible={!busy}
  showHeaderClose={true}
  {onCancel}
  {onConfirm}
>
  <div class="space-y-5">
    <section class="grid gap-4 md:grid-cols-2">
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
            form.requestConfigId = '';
          }}
        />
      </div>

      <label class="block text-sm">
        <span class="mb-1 block text-(--color-fg-3)">请求配置</span>
        <SingleSelectCombobox
          options={requestConfigOptions}
          selectedId={form.requestConfigId}
          placeholder="选择请求配置"
          onChoose={({ id }) => {
            form.requestConfigId = id;
          }}
        />
      </label>

      <label class="block text-sm">
        <span class="mb-1 block text-(--color-fg-3)">调度模式</span>
        <select class={inputClass} bind:value={form.scheduleMode}>
          {#each catalog.schedule_modes as item (item.key)}
            <option value={item.key}>{formatCatalogOption(item)}</option>
          {/each}
        </select>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block text-(--color-fg-3)">时区</span>
        <input class={inputClass} bind:value={form.timezone} />
      </label>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      {#if isCronMode}
        <label class="block text-sm md:col-span-2">
          <span class="mb-1 block text-(--color-fg-3)">Cron</span>
          <input class={inputClass} bind:value={form.cron} />
        </label>
      {:else}
        <label class="block text-sm">
          <span class="mb-1 block text-(--color-fg-3)">间隔秒数</span>
          <input class={inputClass} bind:value={form.intervalSeconds} />
        </label>

        <label class="block text-sm">
          <span class="mb-1 block text-(--color-fg-3)">抖动秒数</span>
          <input class={inputClass} bind:value={form.jitterSeconds} />
        </label>
      {/if}
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      {#if isUpstreamTask}
        <label class="block text-sm md:col-span-2">
          <span class="mb-1 block text-(--color-fg-3)">上游源 ID</span>
          <input class={inputClass} bind:value={form.sourceId} />
        </label>
      {:else}
        <label class="block text-sm">
          <span class="mb-1 block text-(--color-fg-3)">目标范围</span>
          <select class={inputClass} bind:value={form.targetKind}>
            {#each catalog.request_target_kinds as item (item.key)}
              <option value={item.key}>{formatCatalogOption(item)}</option>
            {/each}
          </select>
        </label>

        {#if isRSSFetchTask}
          <label class="block text-sm">
            <span class="mb-1 block text-(--color-fg-3)">Feed 模式</span>
            <select class={inputClass} bind:value={form.feedMode}>
              {#each catalog.rss_feed_modes as item (item.key)}
                <option value={item.key}>{formatCatalogOption(item)}</option>
              {/each}
            </select>
          </label>
        {/if}

        {#if form.targetKind === 'SITE'}
          <label class="block text-sm md:col-span-2">
            <span class="mb-1 block text-(--color-fg-3)">站点 ID</span>
            <input class={inputClass} bind:value={form.targetSiteId} />
          </label>
        {/if}

        {#if form.targetKind === 'SITE_LIST'}
          <label class="block text-sm md:col-span-2">
            <span class="mb-1 block text-(--color-fg-3)">站点 ID 列表</span>
            <textarea class={textareaClass} bind:value={form.targetSiteIds}></textarea>
          </label>
        {/if}
      {/if}
    </section>

    {#if isSiteCheckTask}
      <section class="grid gap-4 md:grid-cols-2">
        <label class="toggle-check">
          <input type="checkbox" bind:checked={form.runContentValidation} />
          <span class="toggle-check-box"></span>
          <span class="toggle-check-copy">
            <strong>包含内容校验</strong>
            <small>本调度建单时附带内容校验任务。</small>
          </span>
        </label>

        <label class="toggle-check">
          <input type="checkbox" bind:checked={form.runGlobalCheck} />
          <span class="toggle-check-box"></span>
          <span class="toggle-check-copy">
            <strong>包含全局检测</strong>
            <small>本调度建单时附带全局检测任务。</small>
          </span>
        </label>

        {#if form.targetKind === 'ALL_VISIBLE'}
          <label class="toggle-check md:col-span-2">
            <input type="checkbox" bind:checked={form.runFullCheck} />
            <span class="toggle-check-box"></span>
            <span class="toggle-check-copy">
              <strong>全量检测</strong>
              <small>默认只检测状态正常且前台可见站点；勾选后检测全部前台可见站点。</small>
            </span>
          </label>
        {/if}
      </section>
    {/if}

    <label class="toggle-check">
      <input type="checkbox" bind:checked={form.isEnabled} />
      <span class="toggle-check-box"></span>
      <span class="toggle-check-copy">
        <strong>保存后启用</strong>
        <small>关闭后保留定义，但不会继续建单。</small>
      </span>
    </label>
  </div>
</ModalDialog>
