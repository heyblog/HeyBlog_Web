<script lang="ts">
  import { IconSearch, IconX } from '@tabler/icons-svelte-runes';
  import type { Snippet } from 'svelte';

  type HighlightToken =
    | {
        kind: 'plain';
        text: string;
      }
    | {
        kind: 'structured';
        field: string;
        value: string;
      };

  type DisplaySummary = {
    leading: HighlightToken[];
    trailing: string;
  };

  let {
    value = '',
    pending = false,
    onChange,
    onSubmit,
    onClear,
    footerStart,
    footerEnd,
    footerDetails,
    footerDetailsOpen = false,
  }: {
    value?: string;
    pending?: boolean;
    onChange?: (value: string) => void;
    onSubmit?: () => void;
    onClear?: () => void;
    footerStart?: Snippet;
    footerEnd?: Snippet;
    footerDetails?: Snippet;
    footerDetailsOpen?: boolean;
  } = $props();

  let inputEl: HTMLInputElement | null = null;
  let isComposing = $state(false);
  let isFocused = $state(false);

  function createTokens(input: string, composing: boolean): HighlightToken[] {
    if (!input) {
      return [];
    }

    if (composing) {
      return [{ kind: 'plain', text: input }];
    }

    const pattern = /\b(main|sub|warning|program|site|domain|rss|featured|access):(?:"[^"]*"|\S+)/g;
    const tokens: HighlightToken[] = [];
    let lastIndex = 0;

    for (const match of input.matchAll(pattern)) {
      const start = match.index ?? 0;
      const full = match[0];
      const separatorIndex = full.indexOf(':');

      if (start > lastIndex) {
        tokens.push({
          kind: 'plain',
          text: input.slice(lastIndex, start),
        });
      }

      tokens.push({
        kind: 'structured',
        field: full.slice(0, separatorIndex + 1),
        value: full.slice(separatorIndex + 1),
      });

      lastIndex = start + full.length;
    }

    if (lastIndex < input.length) {
      tokens.push({
        kind: 'plain',
        text: input.slice(lastIndex),
      });
    }

    return tokens;
  }

  function createDisplaySummary(tokens: HighlightToken[]): DisplaySummary {
    const leading: HighlightToken[] = [];
    const trailing: string[] = [];
    let keepLeading = true;

    for (const token of tokens) {
      if (keepLeading) {
        if (token.kind === 'structured') {
          leading.push(token);
          continue;
        }

        if (!token.text.trim()) {
          continue;
        }

        keepLeading = false;
      }

      trailing.push(token.kind === 'plain' ? token.text : `${token.field}${token.value}`);
    }

    return {
      leading,
      trailing: trailing.join('').trim(),
    };
  }

  const highlightTokens = $derived(createTokens(value, isComposing));
  const displaySummary = $derived(createDisplaySummary(highlightTokens));
  const showSummaryOverlay = $derived(!isFocused && !isComposing);

  function handleInput(event: Event) {
    const target = event.currentTarget;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    onChange?.(target.value);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !isComposing) {
      event.preventDefault();
      onSubmit?.();
    }
  }

  function handleClear() {
    onClear?.();

    requestAnimationFrame(() => {
      inputEl?.focus();
    });
  }
</script>

<div class="overflow-hidden rounded-md border border-(--color-line-med) bg-(--color-bg)">
  <div class="flex items-stretch">
    <div class="relative min-w-0 flex-1">
      {#if showSummaryOverlay}
        <div
          class="pointer-events-none absolute inset-0 flex items-center px-11 pr-12 text-[15px] leading-6"
          aria-hidden="true"
        >
          {#if displaySummary.leading.length > 0}
            <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              <div class="flex max-w-[55%] min-w-0 items-center gap-1 overflow-hidden">
                {#each displaySummary.leading as token (token)}
                  {#if token.kind === 'structured'}
                    <span
                      class="inline-flex max-w-30 min-w-0 items-baseline gap-0.5 overflow-hidden rounded-[4px] bg-[color-mix(in_srgb,var(--color-info)_8%,transparent)] px-1.5 py-1 align-middle text-[13px]"
                    >
                      <span class="shrink-0 font-mono text-(--color-info)">
                        {token.field}
                      </span>
                      <span class="min-w-0 truncate text-(--color-fg)">
                        {token.value}
                      </span>
                    </span>
                  {/if}
                {/each}
              </div>

              <div class="min-w-0 flex-1 truncate text-(--color-fg-2)">
                {displaySummary.trailing || '继续输入关键词…'}
              </div>
            </div>
          {:else}
            <div class="truncate text-(--color-fg-2)">{value}</div>
          {/if}
        </div>
      {/if}

      <div class="absolute inset-y-0 left-0 z-20 flex items-center px-4 text-(--color-fg-3)">
        <IconSearch size={18} stroke={1.8} class="block" />
      </div>

      <input
        bind:this={inputEl}
        type="text"
        {value}
        class={`relative z-10 h-12 w-full bg-transparent px-11 pr-12 text-[15px] leading-6 outline-none placeholder:text-(--color-fg-3) ${
          showSummaryOverlay
            ? 'text-transparent caret-transparent'
            : 'text-(--color-fg) caret-(--color-fg)'
        }`}
        placeholder="搜索站点，支持使用结构化语法"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        oninput={handleInput}
        onkeydown={handleKeydown}
        onfocus={() => {
          isFocused = true;
        }}
        onblur={() => {
          isFocused = false;
        }}
        oncompositionstart={() => {
          isComposing = true;
        }}
        oncompositionend={(event) => {
          isComposing = false;
          handleInput(event);
        }}
        aria-label="站点目录搜索"
      />

      {#if value.trim()}
        <button
          class="absolute inset-y-0 right-0 z-20 inline-flex items-center justify-center px-3 text-(--color-fg-3) transition hover:text-(--color-fg)"
          type="button"
          onclick={handleClear}
          aria-label="清空搜索"
        >
          <span
            class="inline-flex size-7 items-center justify-center rounded-[4px] hover:bg-(--color-bg-raised)"
          >
            <IconX size={15} stroke={1.9} class="block" />
          </span>
        </button>
      {/if}
    </div>

    <button
      class="inline-flex h-12 shrink-0 items-center justify-center border-l border-(--color-line) px-4 text-sm font-medium text-(--color-fg) transition hover:bg-(--color-bg-raised) disabled:cursor-not-allowed disabled:text-(--color-fg-3)"
      type="button"
      onclick={() => onSubmit?.()}
      disabled={pending}
    >
      {pending ? '搜索中…' : '搜索'}
    </button>
  </div>

  {#if footerStart || footerEnd || footerDetails}
    <div class="border-t border-(--color-line) px-3 py-2">
      <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
        <div class="min-w-0 overflow-hidden">
          {@render footerStart?.()}
        </div>
        <div class="shrink-0 justify-self-end">
          <div class="flex items-center justify-end">
            {@render footerEnd?.()}
          </div>
        </div>
      </div>

      {#if footerDetails && footerDetailsOpen}
        <div class="mt-2 border-t border-(--color-line) pt-2">
          {@render footerDetails?.()}
        </div>
      {/if}
    </div>
  {/if}
</div>
