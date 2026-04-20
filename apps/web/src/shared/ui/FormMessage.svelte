<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    tone = 'info',
    eyebrow = '',
    title = '',
    message = '',
    children,
  }: {
    tone?: 'info' | 'success' | 'warning' | 'error';
    eyebrow?: string;
    title?: string;
    message?: string;
    children?: Snippet;
  } = $props();

  const toneClassMap = {
    info: {
      border: 'border-[color:color-mix(in_srgb,var(--color-info)_24%,var(--color-line))]',
      eyebrow: 'text-[color:var(--color-info)]',
      title: 'text-[color:var(--color-fg)]',
      text: 'text-[color:var(--color-fg-2)]',
    },
    success: {
      border: 'border-[color:color-mix(in_srgb,var(--color-ok)_24%,var(--color-line))]',
      eyebrow: 'text-[color:var(--color-ok)]',
      title: 'text-[color:var(--color-fg)]',
      text: 'text-[color:var(--color-fg-2)]',
    },
    warning: {
      border: 'border-[color:color-mix(in_srgb,var(--color-warn)_24%,var(--color-line))]',
      eyebrow: 'text-[color:var(--color-warn)]',
      title: 'text-[color:var(--color-fg)]',
      text: 'text-[color:var(--color-fg-2)]',
    },
    error: {
      border: 'border-[color:color-mix(in_srgb,var(--color-fail)_24%,var(--color-line))]',
      eyebrow: 'text-[color:var(--color-fail)]',
      title: 'text-[color:var(--color-fg)]',
      text: 'text-[color:var(--color-fg-2)]',
    },
  } as const;

  let toneClass = $derived(toneClassMap[tone]);
</script>

<section
  class={`rounded-[5px] border bg-[color:var(--color-bg-raised)] p-4 ${toneClass.border}`}
  role={tone === 'error' ? 'alert' : 'status'}
>
  {#if eyebrow}
    <p class={`font-mono text-[11px] tracking-[0.18em] uppercase ${toneClass.eyebrow}`}>
      {eyebrow}
    </p>
  {/if}

  {#if title}
    <h3 class={`mt-2 text-base leading-tight ${toneClass.title}`}>{title}</h3>
  {/if}

  {#if message}
    <p class={`mt-3 text-sm leading-7 ${toneClass.text}`}>{message}</p>
  {/if}

  <div class="mt-3 space-y-3 empty:hidden">
    {@render children?.()}
  </div>
</section>
