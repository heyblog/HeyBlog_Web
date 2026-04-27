<script lang="ts">
  import { IconChevronDown, IconInfoCircle } from '@tabler/icons-svelte-runes';

  import type { SiteDirectoryMeta } from '@/application/site/site-directory.models';
  import {
    SITE_DIRECTORY_SEARCH_HINTS,
    type SiteDirectoryStructuredSearchState,
  } from '@/application/site/site-directory.search';
  import {
    formatDirectoryCount,
    SITE_DIRECTORY_ACCESS_OPTIONS,
    SITE_DIRECTORY_BOOLEAN_OPTIONS,
    summarizeDirectorySelection,
  } from '@/components/site/site-directory-page.shared';
  import SiteDirectoryFilterPopover from '@/components/site/SiteDirectoryFilterPopover.svelte';
  import SiteStructuredSearchBox from '@/components/site/SiteStructuredSearchBox.svelte';

  let {
    meta,
    value,
    pending = false,
    structured,
    syntaxHelpOpen = false,
    accessSummary = '',
    featuredSummary = '',
    onSearchChange,
    onSearchSubmit,
    onSearchClear,
    onSyntaxToggle,
    onInsertSyntaxSnippet,
    onSearchDrivenFilter,
    onBooleanFilter,
  }: {
    meta: SiteDirectoryMeta;
    value: string;
    pending?: boolean;
    structured: SiteDirectoryStructuredSearchState;
    syntaxHelpOpen?: boolean;
    accessSummary?: string;
    featuredSummary?: string;
    onSearchChange?: (value: string) => void;
    onSearchSubmit?: () => void;
    onSearchClear?: () => void;
    onSyntaxToggle?: () => void;
    onInsertSyntaxSnippet?: (snippet: string) => void;
    onSearchDrivenFilter?: (
      field: 'main' | 'sub' | 'warning' | 'program' | 'access',
      value: string,
      multiple: boolean,
    ) => void;
    onBooleanFilter?: (field: 'rss' | 'featured', value: boolean) => void;
  } = $props();
</script>

<section class="page-section pt-2">
  <div class="section-head">
    <div>
      <p class="eyebrow">
        <span class="status-dot" style="--status-dot: var(--color-info-dot)"></span>
        Blog List
      </p>
      <h1 class="section-title text-[clamp(2rem,5vw,3.5rem)] leading-[0.96] tracking-[-0.04em]">
        博客列表
      </h1>
    </div>
  </div>

  <div
    class="mt-6 flex flex-wrap items-center justify-center gap-0 rounded-md border border-(--color-line) bg-(--color-bg) px-2 py-3"
  >
    <div class="min-w-36 px-5 text-center">
      <p class="font-mono text-[10px] tracking-[0.16em] text-(--color-fg-3) uppercase">站点总数</p>
      <p class="mt-2 text-2xl tracking-[-0.04em] text-(--color-fg)">
        {formatDirectoryCount(meta.stats.totalSites)}
      </p>
    </div>
    <div class="h-10 w-px bg-(--color-line)"></div>
    <div class="min-w-36 px-5 text-center">
      <p class="font-mono text-[10px] tracking-[0.16em] text-(--color-fg-3) uppercase">状态正常</p>
      <p class="mt-2 text-2xl tracking-[-0.04em] text-(--color-fg)">
        {formatDirectoryCount(meta.stats.normalSites)}
      </p>
    </div>
    <div class="h-10 w-px bg-(--color-line)"></div>
    <div class="min-w-36 px-5 text-center">
      <p class="font-mono text-[10px] tracking-[0.16em] text-(--color-fg-3) uppercase">
        已接入 RSS
      </p>
      <p class="mt-2 text-2xl tracking-[-0.04em] text-(--color-fg)">
        {formatDirectoryCount(meta.stats.rssSites)}
      </p>
    </div>
  </div>

  <div class="mt-6">
    <SiteStructuredSearchBox
      {value}
      {pending}
      footerDetailsOpen={syntaxHelpOpen}
      onChange={onSearchChange}
      onSubmit={onSearchSubmit}
      onClear={onSearchClear}
    >
      {#snippet footerStart()}
        <div class="flex w-full min-w-0 items-center gap-2.5 overflow-hidden whitespace-nowrap">
          <div class="shrink-0">
            <SiteDirectoryFilterPopover
              label="推荐"
              title="筛选推荐状态"
              items={SITE_DIRECTORY_BOOLEAN_OPTIONS.map((item) => ({
                key: item.key,
                label: item.key === 'true' ? '已推荐' : '未推荐',
              }))}
              selected={structured.featured === null ? [] : [String(structured.featured)]}
              multiple={false}
              searchable={false}
              triggerVariant="ghost"
              selectedSummary={featuredSummary}
              widthClass="w-[11rem]"
              onToggle={(item) => onBooleanFilter?.('featured', item === 'true')}
            />
          </div>
          <div class="shrink-0">
            <SiteDirectoryFilterPopover
              label="主标签"
              title="筛选主标签"
              items={meta.filters.mainTags.map((item) => ({
                key: item.name,
                label: item.name,
              }))}
              selected={structured.main}
              multiple={false}
              triggerVariant="ghost"
              selectedSummary={summarizeDirectorySelection(structured.main)}
              onToggle={(item) => onSearchDrivenFilter?.('main', item, false)}
            />
          </div>
          <div class="shrink-0">
            <SiteDirectoryFilterPopover
              label="子标签"
              title="筛选子标签"
              items={meta.filters.subTags.map((item) => ({
                key: item.name,
                label: item.name,
              }))}
              selected={structured.sub}
              multiple={true}
              triggerVariant="ghost"
              selectedSummary={summarizeDirectorySelection(structured.sub)}
              onToggle={(item) => onSearchDrivenFilter?.('sub', item, true)}
            />
          </div>

          <div class="shrink-0">
            <SiteDirectoryFilterPopover
              label="程序"
              title="筛选程序"
              items={meta.filters.programs.map((item) => ({
                key: item.name,
                label: item.name,
              }))}
              selected={structured.program}
              multiple={false}
              triggerVariant="ghost"
              selectedSummary={summarizeDirectorySelection(structured.program)}
              onToggle={(item) => onSearchDrivenFilter?.('program', item, false)}
            />
          </div>
          <div class="hidden shrink-0 sm:block">
            <SiteDirectoryFilterPopover
              label="警示标签"
              title="筛选警示标签"
              items={meta.filters.warningTags.map((item) => ({
                key: item.name,
                label: item.name,
              }))}
              selected={structured.warning}
              multiple={true}
              triggerVariant="ghost"
              selectedSummary={summarizeDirectorySelection(structured.warning)}
              onToggle={(item) => onSearchDrivenFilter?.('warning', item, true)}
            />
          </div>
          <div class="hidden shrink-0 sm:block">
            <SiteDirectoryFilterPopover
              label="访问范围"
              title="筛选访问范围"
              items={SITE_DIRECTORY_ACCESS_OPTIONS.map((item) => ({
                key: item.key,
                label: item.label,
              }))}
              selected={structured.access}
              multiple={false}
              searchable={false}
              triggerVariant="ghost"
              selectedSummary={accessSummary}
              widthClass="w-[14rem]"
              onToggle={(item) => onSearchDrivenFilter?.('access', item, false)}
            />
          </div>
        </div>
      {/snippet}

      {#snippet footerEnd()}
        <button
          class="inline-flex h-6 items-center gap-1.5 rounded-sm px-0 text-sm text-(--color-fg-3) transition hover:text-(--color-fg)"
          type="button"
          onclick={onSyntaxToggle}
          aria-expanded={syntaxHelpOpen}
        >
          <IconInfoCircle size={14} stroke={1.9} class="block" />
          <span>语法说明</span>
          <IconChevronDown
            size={14}
            stroke={1.9}
            class={`block transition-transform ${syntaxHelpOpen ? 'rotate-180' : ''}`}
          />
        </button>
      {/snippet}

      {#snippet footerDetails()}
        {#if syntaxHelpOpen}
          <div class="space-y-3">
            <div class="flex flex-wrap gap-2">
              {#each SITE_DIRECTORY_SEARCH_HINTS as hint (hint.field)}
                <button
                  class="inline-flex items-center rounded-sm border border-(--color-line) px-2 py-1 font-mono text-[11px] text-(--color-fg-3) transition hover:border-(--color-line-med) hover:bg-(--color-bg) hover:text-(--color-fg)"
                  type="button"
                  onclick={() => onInsertSyntaxSnippet?.(hint.snippet)}
                >
                  {hint.field}
                </button>
              {/each}
            </div>

            <div class="space-y-2">
              {#each SITE_DIRECTORY_SEARCH_HINTS as hint (hint.field)}
                <div class="rounded-sm px-2 py-1.5">
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      class="font-mono text-[11px] text-(--color-info) transition hover:text-(--color-fg)"
                      type="button"
                      onclick={() => onInsertSyntaxSnippet?.(hint.snippet)}
                    >
                      {hint.snippet}
                    </button>
                    <code class="text-[11px] text-(--color-fg-3)">{hint.example}</code>
                  </div>
                  <p class="mt-1 text-xs leading-5 text-(--color-fg-3)">
                    {hint.description}
                  </p>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/snippet}
    </SiteStructuredSearchBox>
  </div>
</section>
