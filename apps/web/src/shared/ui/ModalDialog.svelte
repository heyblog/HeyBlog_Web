<script lang="ts">
  import type { ComponentProps, Snippet } from 'svelte';

  import ModalSurface from './ModalSurface.svelte';

  type ModalTone = ComponentProps<typeof ModalSurface>['tone'];

  let {
    open = false,
    title = '',
    description = '',
    content = '',
    tone = 'neutral',
    panelClass = '',
    confirmLabel = '确定',
    cancelLabel = '取消',
    dismissible = true,
    showHeaderClose = true,
    onConfirm,
    onCancel,
    children: childContent,
  }: {
    open?: boolean;
    title?: string;
    description?: string;
    content?: string;
    tone?: ModalTone;
    panelClass?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    dismissible?: boolean;
    showHeaderClose?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
    children?: Snippet;
  } = $props();
</script>

<ModalSurface
  {open}
  {title}
  {description}
  {tone}
  {panelClass}
  {confirmLabel}
  {cancelLabel}
  {dismissible}
  {showHeaderClose}
  showCancel={true}
  {onConfirm}
  {onCancel}
>
  {#if content}
    <p>{content}</p>
  {/if}
  {@render childContent?.()}
</ModalSurface>
