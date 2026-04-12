<script lang="ts">
  import { onMount } from 'svelte';

  interface SingleSelectOption {
    id: string;
    name: string;
  }

  let {
    options = [],
    selectedId = $bindable(''),
    selectedLabel = '',
    inputId = '',
    placeholder = '搜索并选择',
    emptyLabel = '暂无匹配结果',
    customActionLabel = '使用自定义信息',
    disabled = false,
    onChoose,
    onRequestCustom,
  }: {
    options?: SingleSelectOption[];
    selectedId?: string;
    selectedLabel?: string;
    inputId?: string;
    placeholder?: string;
    emptyLabel?: string;
    customActionLabel?: string;
    disabled?: boolean;
    onChoose?: (detail: { id: string }) => void;
    onRequestCustom?: (detail: { query: string }) => void;
  } = $props();

  let root: HTMLDivElement | null = null;
  let input: HTMLInputElement | null = null;
  let isOpen = $state(false);
  let query = $state('');

  const normalize = (value: string) => value.trim();
  const normalizeToken = (value: string) =>
    normalize(value)
      .toLocaleLowerCase('zh-CN')
      .replace(/[^\p{L}\p{N}]+/gu, '');
  const isSubsequence = (needle: string, haystack: string) => {
    if (!needle) {
      return true;
    }

    let cursor = 0;
    for (const char of haystack) {
      if (char === needle[cursor]) {
        cursor += 1;
        if (cursor === needle.length) {
          return true;
        }
      }
    }

    return false;
  };

  let selectedOption = $derived(options.find((option) => option.id === selectedId) ?? null);
  let resolvedSelectedLabel = $derived(normalize(selectedLabel));
  let selectedDisplayName = $derived(selectedOption?.name ?? resolvedSelectedLabel);
  let normalizedQuery = $derived(normalize(query).toLocaleLowerCase('zh-CN'));
  let queryToken = $derived(normalizeToken(query));
  let filteredOptions = $derived.by(() =>
    options.filter((option) => {
      if (!normalizedQuery && !queryToken) {
        return true;
      }

      const lowerName = option.name.toLocaleLowerCase('zh-CN');
      const nameToken = normalizeToken(option.name);

      if (normalizedQuery && lowerName.includes(normalizedQuery)) {
        return true;
      }

      if (!queryToken) {
        return false;
      }

      return (
        nameToken.startsWith(queryToken) ||
        nameToken.includes(queryToken) ||
        isSubsequence(queryToken, nameToken)
      );
    }),
  );

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

  function handleSelect(optionId: string) {
    // Keep selected state responsive in this component, then notify parent.
    selectedId = optionId;
    onChoose?.({ id: optionId });
    close();
  }

  function handleCustom() {
    const value = normalize(query);
    selectedId = '';
    onRequestCustom?.({ query: value });
    close();
  }

  let canRequestCustom = $derived(normalize(query).length > 0);

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
    class={`min-h-11 rounded-[5px] border bg-(--color-bg-raised) px-3 py-2 text-sm transition ${
      disabled
        ? 'cursor-not-allowed border-(--color-line) opacity-70'
        : 'cursor-text border-(--color-line-med) focus-within:border-red-700/35 dark:focus-within:border-red-400/35'
    }`}
    role="button"
    tabindex={disabled ? -1 : 0}
    onclick={() => {
      open();
      focusInput();
    }}
    onkeydown={(event) => {
      if (event.key === 'Escape') {
        close();
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (filteredOptions[0]) {
          handleSelect(filteredOptions[0].id);
        } else if (normalize(query)) {
          handleCustom();
        }
      }
    }}
  >
    <div class="flex flex-wrap items-center gap-2">
      {#if selectedDisplayName}
        <span
          class="inline-flex items-center gap-2 rounded-[999px] border border-(--color-line-med) px-3 py-1 text-xs text-(--color-fg)"
        >
          {selectedDisplayName}
        </span>
      {/if}
      <input
        id={inputId}
        bind:this={input}
        bind:value={query}
        class="combobox-input-reset min-w-36 flex-1 bg-transparent py-1 text-sm text-(--color-fg) outline-none placeholder:text-(--color-fg-3)"
        {disabled}
        placeholder={selectedDisplayName ? `当前：${selectedDisplayName}` : placeholder}
        onfocus={open}
        oninput={open}
      />
    </div>
  </div>

  {#if isOpen && !disabled}
    <div
      class="absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-[5px] border border-(--color-line-med) bg-(--color-bg-raised) shadow-[0_18px_40px_rgba(28,25,23,0.14)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.34)]"
    >
      <div class="max-h-72 overflow-y-auto p-2">
        {#if filteredOptions.length > 0}
          <div class="space-y-1">
            {#each filteredOptions as option (option.id)}
              <button
                class={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm transition ${
                  selectedId === option.id
                    ? 'border border-(--color-line-med) text-(--color-fg)'
                    : 'text-(--color-fg-2) hover:bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)] hover:text-(--color-fg)'
                }`}
                type="button"
                onclick={() => handleSelect(option.id)}
              >
                <span>{option.name}</span>
                {#if selectedId === option.id}
                  <span
                    class="font-mono text-[11px] uppercase tracking-[0.18em] text-(--color-info)"
                    >已选</span
                  >
                {/if}
              </button>
            {/each}
          </div>
          {#if canRequestCustom}
            <div class="mt-2 border-t border-(--color-line) pt-2">
              <button
                class="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm text-(--color-fg) transition hover:bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)]"
                type="button"
                onclick={handleCustom}
              >
                <span>{customActionLabel}</span>
                <span class="font-mono text-[11px] text-(--color-fg-3)">{normalize(query)}</span>
              </button>
            </div>
          {/if}
        {:else}
          <div class="space-y-2 px-1 py-1">
            <p class="px-2 py-1 text-sm text-(--color-fg-3)">{emptyLabel}</p>
            {#if canRequestCustom}
              <button
                class="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm text-(--color-fg) transition hover:bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)]"
                type="button"
                onclick={handleCustom}
              >
                <span>{customActionLabel}</span>
                <span class="font-mono text-[11px] text-(--color-fg-3)">{normalize(query)}</span>
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
