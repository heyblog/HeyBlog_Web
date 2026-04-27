<script lang="ts">
  type TabItem = {
    key: string;
    label: string;
    description: string;
    count?: number;
  };

  let {
    items,
    activeKey,
    ariaLabel = '任务中心选项卡',
    onSelect,
  }: {
    items: TabItem[];
    activeKey: string;
    ariaLabel?: string;
    onSelect?: (key: string) => void;
  } = $props();

  function handleKeydown(event: KeyboardEvent, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }

    event.preventDefault();
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % items.length
        : (index - 1 + items.length) % items.length;
    onSelect?.(items[nextIndex]?.key ?? activeKey);
  }
</script>

<div
  class="grid gap-2 rounded-md border border-(--color-line) bg-(--color-bg-raised) p-2 md:grid-cols-2 xl:grid-cols-4"
  role="tablist"
  aria-label={ariaLabel}
>
  {#each items as item, index (item.key)}
    <button
      id={`task-tab-${item.key}`}
      class={`rounded-md border px-4 py-3 text-left transition ${
        activeKey === item.key
          ? 'border-[color-mix(in_srgb,var(--color-info)_24%,var(--color-line))] bg-(--color-bg-raised)'
          : 'border-transparent bg-transparent hover:border-(--color-line-med) hover:bg-(--color-bg-raised)'
      }`}
      role="tab"
      aria-selected={activeKey === item.key}
      aria-controls={`task-panel-${item.key}`}
      tabindex={activeKey === item.key ? 0 : -1}
      type="button"
      onclick={() => onSelect?.(item.key)}
      onkeydown={(event) => handleKeydown(event, index)}
    >
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm font-medium text-(--color-fg)">{item.label}</span>
        {#if typeof item.count === 'number'}
          <span
            class={`rounded-full px-2 py-0.5 text-[11px] ${
              activeKey === item.key
                ? 'bg-[color-mix(in_srgb,var(--color-info)_16%,transparent)] text-(--color-info)'
                : 'bg-[color-mix(in_srgb,var(--color-line)_72%,transparent)] text-(--color-fg-3)'
            }`}
          >
            {item.count}
          </span>
        {/if}
      </div>
      <p class="mt-2 text-xs leading-5 text-(--color-fg-3)">{item.description}</p>
    </button>
  {/each}
</div>
