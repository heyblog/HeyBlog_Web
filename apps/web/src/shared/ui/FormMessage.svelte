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
      border: 'border-[color-mix(in_srgb,var(--color-info)_24%,var(--color-line))]',
      eyebrow: 'text-(--color-info)',
      title: 'text-(--color-fg)',
      text: 'text-(--color-fg-2)',
    },
    success: {
      border: 'border-[color-mix(in_srgb,var(--color-ok)_24%,var(--color-line))]',
      eyebrow: 'text-(--color-ok)',
      title: 'text-(--color-fg)',
      text: 'text-(--color-fg-2)',
    },
    warning: {
      border: 'border-[color-mix(in_srgb,var(--color-warn)_24%,var(--color-line))]',
      eyebrow: 'text-(--color-warn)',
      title: 'text-(--color-fg)',
      text: 'text-(--color-fg-2)',
    },
    error: {
      border: 'border-[color-mix(in_srgb,var(--color-fail)_24%,var(--color-line))]',
      eyebrow: 'text-(--color-fail)',
      title: 'text-(--color-fg)',
      text: 'text-(--color-fg-2)',
    },
  } as const;

  let toneClass = $derived(toneClassMap[tone]);
</script>

<section
  class={`rounded-md border bg-(--color-bg-raised) p-4 ${toneClass.border}`}
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
