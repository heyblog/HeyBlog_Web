<script lang="ts">
  import type { BlogCardTone } from '@/application/site/site-card.shared';
  import type { SiteWarningTagView } from '@/application/site/site-directory.models';

  let {
    primaryTag = null,
    subTags = [],
    warningTags = [],
    tone = 'stone',
    compact = false,
    singleLine = false,
  }: {
    primaryTag?: string | null;
    subTags?: string[];
    warningTags?: SiteWarningTagView[];
    tone?: BlogCardTone;
    compact?: boolean;
    singleLine?: boolean;
  } = $props();

  const primaryToneClass = {
    amber:
      'border-[color:color-mix(in_srgb,var(--color-warn)_24%,var(--color-line))] bg-[color:color-mix(in_srgb,var(--color-warn)_7%,transparent)] text-[color:var(--color-warn)]',
    blue: 'border-[color:color-mix(in_srgb,var(--color-info)_24%,var(--color-line))] bg-[color:color-mix(in_srgb,var(--color-info)_7%,transparent)] text-[color:var(--color-info)]',
    emerald:
      'border-[color:color-mix(in_srgb,var(--color-ok)_24%,var(--color-line))] bg-[color:color-mix(in_srgb,var(--color-ok)_7%,transparent)] text-[color:var(--color-ok)]',
    red: 'border-[color:color-mix(in_srgb,var(--color-fail)_24%,var(--color-line))] bg-[color:color-mix(in_srgb,var(--color-fail)_7%,transparent)] text-[color:var(--color-fail)]',
    stone:
      'border-[color:color-mix(in_srgb,var(--color-fg-2)_18%,var(--color-line))] bg-[color:var(--color-bg-raised)] text-[color:var(--color-fg-2)]',
  } satisfies Record<BlogCardTone, string>;

  const baseClass = $derived(
    compact
      ? 'inline-flex items-center rounded-[4px] border px-2 py-1 font-mono text-[10px] leading-none'
      : 'inline-flex items-center rounded-[4px] border px-2.5 py-1.5 font-mono text-[11px] leading-none',
  );
</script>

<div
  class={singleLine
    ? 'flex items-center gap-1 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    : 'flex flex-wrap items-center gap-2'}
>
  {#if primaryTag}
    <span class={[baseClass, primaryToneClass[tone]].join(' ')}>
      {primaryTag}
    </span>
  {/if}

  {#each subTags as tag (tag)}
    <span class={[baseClass, 'border-(--color-line) bg-transparent text-(--color-fg-3)'].join(' ')}>
      {tag}
    </span>
  {/each}

  {#each warningTags as tag (tag.name)}
    <span
      class={[
        baseClass,
        'border-(--color-fail) bg-(--color-fail) text-white dark:text-(--color-bg)',
      ].join(' ')}
      title={tag.description ?? `${tag.name} 警示标签`}
    >
      {tag.name}
    </span>
  {/each}
</div>
