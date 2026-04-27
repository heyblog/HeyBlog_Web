<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    content = '',
    placement = 'top',
    disabled = false,
    children,
  }: {
    content?: string;
    placement?: 'top' | 'bottom';
    disabled?: boolean;
    children?: Snippet;
  } = $props();

  let open = $state(false);

  let tooltipPositionClass = $derived(
    placement === 'bottom' ? 'top-[calc(100%+0.5rem)]' : 'bottom-[calc(100%+0.5rem)]',
  );
</script>

<span
  class="relative inline-flex"
  role="presentation"
  onmouseenter={() => {
    if (!disabled) {
      open = true;
    }
  }}
  onmouseleave={() => {
    open = false;
  }}
  onfocusin={() => {
    if (!disabled) {
      open = true;
    }
  }}
  onfocusout={() => {
    open = false;
  }}
>
  {@render children?.()}

  {#if open && !disabled && content}
    <span
      class={`pointer-events-none absolute left-1/2 z-20 w-max max-w-60 -translate-x-1/2 rounded-md border border-(--color-line-med) bg-(--color-bg-raised) px-3 py-2 text-xs leading-5 text-(--color-fg-2) shadow-[0_12px_30px_rgba(28,25,23,0.12)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.28)] ${tooltipPositionClass}`}
      role="tooltip"
    >
      {content}
    </span>
  {/if}
</span>
