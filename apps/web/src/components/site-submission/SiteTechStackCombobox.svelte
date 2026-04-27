<script lang="ts">
  import { onMount } from 'svelte';

  import {
    type ComboboxOption,
    filterOptions,
    normalize,
    normalizeKey,
  } from '@/shared/browser/tag-multi-combobox.browser';

  type TechCategory = 'FRAMEWORK' | 'LANGUAGE';
  type TechOption = ComboboxOption & {
    category?: TechCategory;
  };

  const categoryMeta: Record<TechCategory, { label: string; chip: string }> = {
    FRAMEWORK: {
      label: '框架',
      chip: 'bg-[color-mix(in_srgb,var(--color-info)_14%,transparent)] text-(--color-info)',
    },
    LANGUAGE: {
      label: '语言',
      chip: 'bg-[color-mix(in_srgb,var(--color-warn)_14%,transparent)] text-(--color-warn)',
    },
  };

  let {
    options = [],
    frameworkIds = $bindable([] as string[]),
    frameworkCustomNames = $bindable([] as string[]),
    languageIds = $bindable([] as string[]),
    languageCustomNames = $bindable([] as string[]),
    inputId = '',
    placeholder = '搜索或添加技术栈',
    disabled = false,
  }: {
    options?: TechOption[];
    frameworkIds?: string[];
    frameworkCustomNames?: string[];
    languageIds?: string[];
    languageCustomNames?: string[];
    inputId?: string;
    placeholder?: string;
    disabled?: boolean;
  } = $props();

  let root: HTMLDivElement | null = null;
  let input: HTMLInputElement | null = null;
  let isOpen = $state(false);
  let query = $state('');
  let customCategory = $state<TechCategory>('FRAMEWORK');

  function focusInput() {
    input?.focus();
  }

  function open() {
    if (disabled) {
      return;
    }

    isOpen = true;
  }

  function close() {
    isOpen = false;
    query = '';
  }

  function getOptionCategory(option: TechOption): TechCategory {
    return option.category === 'LANGUAGE' ? 'LANGUAGE' : 'FRAMEWORK';
  }

  function toggleOption(option: TechOption) {
    const category = getOptionCategory(option);

    if (category === 'FRAMEWORK') {
      frameworkIds = frameworkIds.includes(option.id)
        ? frameworkIds.filter((value) => value !== option.id)
        : [...frameworkIds, option.id];
      languageIds = languageIds.filter((value) => value !== option.id);
    } else {
      languageIds = languageIds.includes(option.id)
        ? languageIds.filter((value) => value !== option.id)
        : [...languageIds, option.id];
      frameworkIds = frameworkIds.filter((value) => value !== option.id);
    }

    query = '';
    focusInput();
  }

  function removeCustom(category: TechCategory, value: string) {
    const token = normalizeKey(value);

    if (category === 'FRAMEWORK') {
      frameworkCustomNames = frameworkCustomNames.filter((item) => normalizeKey(item) !== token);
      return;
    }

    languageCustomNames = languageCustomNames.filter((item) => normalizeKey(item) !== token);
  }

  function removeSelected(category: TechCategory, optionId: string) {
    if (category === 'FRAMEWORK') {
      frameworkIds = frameworkIds.filter((value) => value !== optionId);
      return;
    }

    languageIds = languageIds.filter((value) => value !== optionId);
  }

  function addCustom() {
    const value = normalize(query);

    if (!value || !canAddCustom) {
      return;
    }

    if (customCategory === 'FRAMEWORK') {
      frameworkCustomNames = [...frameworkCustomNames, value];
    } else {
      languageCustomNames = [...languageCustomNames, value];
    }

    query = '';
    focusInput();
  }

  let normalizedQuery = $derived(normalize(query));
  let optionById = $derived(new Map(options.map((option) => [option.id, option])));
  let selectedOptions = $derived([
    ...frameworkIds
      .map((id) => optionById.get(id))
      .filter((option): option is TechOption => Boolean(option))
      .map((option) => ({
        id: option.id,
        name: option.name,
        category: getOptionCategory(option),
      })),
    ...languageIds
      .map((id) => optionById.get(id))
      .filter((option): option is TechOption => Boolean(option))
      .map((option) => ({
        id: option.id,
        name: option.name,
        category: getOptionCategory(option),
      })),
  ]);
  let customItems = $derived([
    ...frameworkCustomNames.map((name) => ({
      category: 'FRAMEWORK' as const,
      name: normalize(name),
    })),
    ...languageCustomNames.map((name) => ({
      category: 'LANGUAGE' as const,
      name: normalize(name),
    })),
  ]);
  let filteredOptions = $derived(filterOptions(options, normalizedQuery) as TechOption[]);
  let existingTokens = $derived(
    new Set([
      ...options.map((option) => normalizeKey(option.name)),
      ...selectedOptions.map((option) => normalizeKey(option.name)),
      ...customItems.map((item) => normalizeKey(item.name)),
    ]),
  );
  let canAddCustom = $derived(
    normalizedQuery.length > 0 && !existingTokens.has(normalizeKey(normalizedQuery)),
  );

  onMount(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (root?.contains(event.target)) {
        return;
      }

      close();
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  });
</script>

<div class="relative" bind:this={root}>
  <div
    class={`min-h-11 rounded-md border bg-(--color-bg-raised) px-3 py-1.5 text-sm transition ${
      disabled
        ? 'cursor-not-allowed border-(--color-line) opacity-70'
        : 'cursor-text border-(--color-line-med) focus-within:border-red-700/35 dark:focus-within:border-red-400/35'
    }`}
    onclick={() => {
      open();
      focusInput();
    }}
    onkeydown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault();

        if (filteredOptions[0]) {
          toggleOption(filteredOptions[0]);
          return;
        }

        if (canAddCustom) {
          addCustom();
        }
      }

      if (event.key === 'Escape') {
        close();
      }
    }}
    role="button"
    tabindex={disabled ? -1 : 0}
  >
    <div class="flex flex-wrap items-center gap-2">
      {#each selectedOptions as option (option.category + ':' + option.id)}
        <span
          class="inline-flex items-center gap-2 rounded-full border border-(--color-line-med) px-3 py-1 text-xs text-(--color-fg)"
        >
          <span
            class={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryMeta[option.category].chip}`}
          >
            {categoryMeta[option.category].label}
          </span>
          <span>{option.name}</span>
          <button
            class="text-(--color-fg-3) transition hover:text-(--color-fg)"
            type="button"
            aria-label={`移除 ${option.name}`}
            onclick={(event) => {
              event.stopPropagation();
              removeSelected(option.category, option.id);
            }}
          >
            ×
          </button>
        </span>
      {/each}
      {#each customItems as item (item.category + ':' + item.name)}
        <span
          class="inline-flex items-center gap-2 rounded-full border border-dashed border-(--color-line-med) px-3 py-1 text-xs text-(--color-fg)"
        >
          <span
            class={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryMeta[item.category].chip}`}
          >
            {categoryMeta[item.category].label}
          </span>
          <span>{item.name}</span>
          <button
            class="text-(--color-fg-3) transition hover:text-(--color-fg)"
            type="button"
            aria-label={`移除 ${item.name}`}
            onclick={(event) => {
              event.stopPropagation();
              removeCustom(item.category, item.name);
            }}
          >
            ×
          </button>
        </span>
      {/each}
      <input
        id={inputId}
        bind:this={input}
        bind:value={query}
        class="h-8 min-w-36 flex-1 bg-transparent py-0 text-sm leading-8 text-(--color-fg) outline-none placeholder:text-(--color-fg-3)"
        {disabled}
        placeholder={selectedOptions.length === 0 && customItems.length === 0
          ? placeholder
          : '继续搜索或添加'}
        onfocus={open}
        oninput={open}
        onkeydown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();

            if (filteredOptions[0]) {
              toggleOption(filteredOptions[0]);
              return;
            }

            if (canAddCustom) {
              addCustom();
            }
          }
        }}
      />
    </div>
  </div>

  {#if isOpen && !disabled}
    <div
      class="absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-md border border-(--color-line-med) bg-(--color-bg-raised) shadow-[0_18px_40px_rgba(28,25,23,0.14)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.34)]"
    >
      <div class="max-h-80 overflow-y-auto p-2">
        {#if filteredOptions.length > 0}
          <div class="space-y-1">
            {#each filteredOptions as option (option.id)}
              <button
                class={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm transition ${
                  frameworkIds.includes(option.id) || languageIds.includes(option.id)
                    ? 'border border-(--color-line-med) text-(--color-fg)'
                    : 'text-(--color-fg-2) hover:bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)] hover:text-(--color-fg)'
                }`}
                type="button"
                onclick={() => toggleOption(option)}
              >
                <span class="flex items-center gap-2">
                  <span
                    class={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryMeta[getOptionCategory(option)].chip}`}
                  >
                    {categoryMeta[getOptionCategory(option)].label}
                  </span>
                  <span>{option.name}</span>
                </span>
                {#if frameworkIds.includes(option.id) || languageIds.includes(option.id)}
                  <span
                    class="font-mono text-[11px] tracking-[0.18em] text-(--color-info) uppercase"
                    >已选</span
                  >
                {/if}
              </button>
            {/each}
          </div>
          {#if canAddCustom}
            <div class="mt-2 border-t border-(--color-line) pt-3">
              <div class="space-y-3 px-1">
                <div class="flex items-center gap-2 px-2">
                  <span class="text-xs text-(--color-fg-3)">自定义类型</span>
                  <div class="inline-flex rounded-full border border-(--color-line-med) p-1">
                    {#each ['FRAMEWORK', 'LANGUAGE'] as category (category)}
                      <button
                        class={`rounded-full px-3 py-1 text-xs transition ${
                          customCategory === category
                            ? 'bg-(--color-bg) text-(--color-fg)'
                            : 'text-(--color-fg-3) hover:text-(--color-fg)'
                        }`}
                        type="button"
                        onclick={() => {
                          customCategory = category as TechCategory;
                        }}
                      >
                        {categoryMeta[category as TechCategory].label}
                      </button>
                    {/each}
                  </div>
                </div>
                <button
                  class="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm text-(--color-fg) transition hover:bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)]"
                  type="button"
                  onclick={addCustom}
                >
                  <span>添加自定义技术栈</span>
                  <span class="flex items-center gap-2">
                    <span
                      class={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryMeta[customCategory].chip}`}
                    >
                      {categoryMeta[customCategory].label}
                    </span>
                    <span class="font-mono text-[11px] text-(--color-fg-3)">{normalizedQuery}</span>
                  </span>
                </button>
              </div>
            </div>
          {/if}
        {:else if canAddCustom}
          <div class="space-y-3 px-1 py-1">
            <div class="flex items-center gap-2 px-2">
              <span class="text-xs text-(--color-fg-3)">自定义类型</span>
              <div class="inline-flex rounded-full border border-(--color-line-med) p-1">
                {#each ['FRAMEWORK', 'LANGUAGE'] as category (category)}
                  <button
                    class={`rounded-full px-3 py-1 text-xs transition ${
                      customCategory === category
                        ? 'bg-(--color-bg) text-(--color-fg)'
                        : 'text-(--color-fg-3) hover:text-(--color-fg)'
                    }`}
                    type="button"
                    onclick={() => {
                      customCategory = category as TechCategory;
                    }}
                  >
                    {categoryMeta[category as TechCategory].label}
                  </button>
                {/each}
              </div>
            </div>
            <button
              class="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm text-(--color-fg) transition hover:bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)]"
              type="button"
              onclick={addCustom}
            >
              <span>添加自定义技术栈</span>
              <span class="flex items-center gap-2">
                <span
                  class={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryMeta[customCategory].chip}`}
                >
                  {categoryMeta[customCategory].label}
                </span>
                <span class="font-mono text-[11px] text-(--color-fg-3)">{normalizedQuery}</span>
              </span>
            </button>
          </div>
        {:else}
          <p class="px-3 py-3 text-sm text-(--color-fg-3)">输入关键词搜索技术栈。</p>
        {/if}
      </div>
    </div>
  {/if}
</div>
