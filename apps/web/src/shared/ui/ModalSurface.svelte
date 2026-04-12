<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onDestroy } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fade, scale } from 'svelte/transition';

  type ModalTone = 'neutral' | 'info' | 'warning' | 'danger';

  let {
    open = false,
    title = '',
    description = '',
    tone = 'neutral',
    confirmLabel = '确定',
    cancelLabel = '取消',
    dismissible = true,
    showCancel = true,
    showConfirm = true,
    showFooter = true,
    showHeaderClose = false,
    headerCloseAriaLabel = '关闭',
    onConfirm,
    onCancel,
    children,
  }: {
    open?: boolean;
    title?: string;
    description?: string;
    tone?: ModalTone;
    confirmLabel?: string;
    cancelLabel?: string;
    dismissible?: boolean;
    showCancel?: boolean;
    showConfirm?: boolean;
    showFooter?: boolean;
    showHeaderClose?: boolean;
    headerCloseAriaLabel?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    children?: Snippet;
  } = $props();

  const headingToneClassMap: Record<ModalTone, string> = {
    neutral: 'text-[color:var(--color-fg)]',
    info: 'text-[color:var(--color-info)]',
    warning: 'text-[color:var(--color-warn)]',
    danger: 'text-[color:var(--color-fail)]',
  };

  let previousOverflow = '';
  const backdropMotion = { duration: 160, easing: cubicOut };
  const backdropExitMotion = { duration: 140, easing: cubicOut };
  const panelEnterMotion = { duration: 180, start: 0.97, opacity: 0.18, easing: cubicOut };
  const panelExitMotion = { duration: 150, start: 1, opacity: 0.1, easing: cubicOut };
  const transitionHelpers = [fade, scale];
  void transitionHelpers;

  const handleCancel = () => {
    onCancel?.();
  };

  const handleConfirm = () => {
    onConfirm?.();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (!open || !dismissible) {
      return;
    }

    if (event.key === 'Escape') {
      handleCancel();
    }
  };

  const restoreDocumentState = () => {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.style.overflow = previousOverflow;
    previousOverflow = '';
    window.removeEventListener('keydown', handleKeydown);
  };

  $effect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (!open) {
      restoreDocumentState();
      return;
    }

    if (!previousOverflow) {
      previousOverflow = document.body.style.overflow;
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeydown);

    return () => {
      restoreDocumentState();
    };
  });

  onDestroy(() => {
    restoreDocumentState();
  });
</script>

{#if open}
  <div
    class="fixed inset-0 z-80 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-bg)_28%,rgba(12,10,9,0.72))] px-4 py-8"
    in:fade={backdropMotion}
    out:fade={backdropExitMotion}
    onclick={(event) => {
      if (dismissible && event.target === event.currentTarget) {
        handleCancel();
      }
    }}
    role="presentation"
  >
    <div
      class="relative w-full max-w-136 rounded-md border border-(--color-line-med) bg-(--color-bg-raised) p-5 shadow-[0_22px_48px_rgba(28,25,23,0.18)] dark:shadow-[0_22px_48px_rgba(0,0,0,0.42)] sm:p-6"
      in:scale={panelEnterMotion}
      out:scale={panelExitMotion}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-surface-title"
    >
      {#if showHeaderClose}
        <button
          class="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md border border-(--color-line-med) text-(--color-fg-2) transition hover:border-(--color-line-strong) hover:text-(--color-fg)"
          type="button"
          aria-label={headerCloseAriaLabel}
          onclick={handleCancel}
        >
          ×
        </button>
      {/if}

      <div class:list={['space-y-2', showHeaderClose && 'pr-10']}>
        <h2
          id="modal-surface-title"
          class={`text-xl tracking-[-0.03em] ${headingToneClassMap[tone]}`}
        >
          {title}
        </h2>
        {#if description}
          <p class="text-sm leading-6 text-(--color-fg-2)">{description}</p>
        {/if}
      </div>

      <div class="mt-4 text-sm leading-7 text-(--color-fg-2)">
        {@render children?.()}
      </div>

      {#if showFooter}
        <div class="mt-6 flex flex-wrap justify-end gap-3">
          {#if showCancel}
            <button
              class="rounded-md px-4 py-2 text-sm text-(--color-fg-2) transition hover:bg-[color-mix(in_srgb,var(--color-bg)_76%,transparent)] hover:text-(--color-fg)"
              type="button"
              onclick={handleCancel}
            >
              {cancelLabel}
            </button>
          {/if}
          {#if showConfirm}
            <button
              class={`rounded-md px-4 py-2 text-sm transition hover:bg-[color-mix(in_srgb,var(--color-bg)_76%,transparent)] ${
                tone === 'danger'
                  ? 'text-(--color-fail)'
                  : tone === 'warning'
                    ? 'text-(--color-warn)'
                    : tone === 'info'
                      ? 'text-(--color-info)'
                      : 'text-(--color-fg)'
              }`}
              type="button"
              onclick={handleConfirm}
            >
              {confirmLabel}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
