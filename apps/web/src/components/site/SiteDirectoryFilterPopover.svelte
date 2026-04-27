<script lang="ts">
  import { IconCheck, IconChevronDown, IconSearch } from '@tabler/icons-svelte-runes';

  import Popover from '@/shared/ui/Popover.svelte';

  let {
    label,
    title,
    items,
    selected = [],
    multiple = true,
    searchable = true,
    widthClass = 'w-[20rem]',
    selectedSummary = '',
    triggerVariant = 'outline',
    emptyLabel = '没有匹配项',
    onToggle,
  }: {
    label: string;
    title: string;
    items: Array<{ key: string; label: string; description?: string | null }>;
    selected?: string[];
    multiple?: boolean;
    searchable?: boolean;
    widthClass?: string;
    selectedSummary?: string;
    triggerVariant?: 'outline' | 'ghost';
    emptyLabel?: string;
    onToggle?: (key: string) => void;
  } = $props();

  let search = $state('');

  const filteredItems = $derived(
    items.filter((item) => {
      const keyword = search.trim().toLowerCase();

      if (!keyword) {
        return true;
      }

      return (
        item.label.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword) ||
        item.key.toLowerCase().includes(keyword)
      );
    }),
  );

  const selectedSet = $derived(new Set(selected));
</script>

<Popover {title} {widthClass}>
  {#snippet trigger()}
    <button
      class={triggerVariant === 'ghost'
        ? 'inline-flex h-6 items-center gap-1.5 rounded-sm px-0 text-sm text-(--color-fg-3) transition hover:text-(--color-fg)'
        : 'inline-flex h-10 items-center gap-2 rounded-md border border-(--color-line-med) bg-(--color-bg-raised) px-3 text-sm text-(--color-fg-2) transition hover:border-(--color-line-med) hover:text-(--color-fg)'}
      type="button"
    >
      <span>{label}</span>
      {#if selectedSummary}
        <span
          class={triggerVariant === 'ghost'
            ? 'inline-flex items-center text-[11px] text-(--color-fg)'
            : 'inline-flex items-center rounded-full bg-(--color-bg) px-2 py-0.5 text-[11px] text-(--color-fg)'}
        >
          {selectedSummary}
        </span>
      {:else if selected.length > 0}
        <span
          class={triggerVariant === 'ghost'
            ? 'inline-flex min-w-4 justify-center text-[11px] text-(--color-fg)'
            : 'inline-flex min-w-5 justify-center rounded-full bg-(--color-bg) px-1.5 py-0.5 text-[11px] text-(--color-fg)'}
        >
          {selected.length}
        </span>
      {/if}
      <IconChevronDown size={14} stroke={1.9} class="block" />
    </button>
  {/snippet}

  <div class="space-y-3">
    {#if searchable}
      <label
        class="flex items-center gap-2 rounded-md border border-(--color-line-med) bg-(--color-bg) px-3 py-2"
      >
        <IconSearch size={15} stroke={1.8} class="block text-(--color-fg-3)" />
        <input
          bind:value={search}
          class="min-w-0 flex-1 bg-transparent text-sm text-(--color-fg) outline-none placeholder:text-(--color-fg-3)"
          placeholder={`筛选${title}`}
        />
      </label>
    {/if}

    <div class="max-h-72 space-y-1 overflow-y-auto pr-1">
      {#if filteredItems.length === 0}
        <p
          class="rounded-md border border-dashed border-(--color-line-med) px-3 py-3 text-sm text-(--color-fg-3)"
        >
          {emptyLabel}
        </p>
      {/if}

      {#each filteredItems as item (item.key)}
        <button
          class="flex w-full items-start gap-3 rounded-md border border-transparent px-3 py-2 text-left transition hover:border-(--color-line-med) hover:bg-(--color-bg)"
          type="button"
          onclick={() => onToggle?.(item.key)}
        >
          <span
            class={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-sm border ${
              selectedSet.has(item.key)
                ? 'border-(--color-info-dot) bg-(--color-info-dot) text-white'
                : 'border-(--color-line-med) text-transparent'
            }`}
          >
            <IconCheck size={12} stroke={2.2} class="block" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm text-(--color-fg)">{item.label}</span>
            {#if item.description}
              <span class="mt-1 block text-xs leading-5 text-(--color-fg-3)"
                >{item.description}</span
              >
            {/if}
          </span>
        </button>
      {/each}
    </div>

    <p class="text-xs text-(--color-fg-3)">{multiple ? '可多选' : '单选'}</p>
  </div>
</Popover>
