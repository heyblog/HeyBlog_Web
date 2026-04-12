<script lang="ts">
  import { WORKSPACE_TEXTAREA_CLASS } from '@/components/site-submission/site-submission-workspace.constants';

  let {
    comment = $bindable(''),
    generatedSummary,
    pending,
    hasSnapshotChanges,
    commentFieldId,
    onReset,
    onSave,
  }: {
    comment?: string;
    generatedSummary: string;
    pending: boolean;
    hasSnapshotChanges: boolean;
    commentFieldId: string;
    onReset: () => void;
    onSave: () => void;
  } = $props();
</script>

<label class="block space-y-2" for={commentFieldId}>
  <span class="block text-sm">修改补充说明</span>
  <textarea
    id={commentFieldId}
    class={WORKSPACE_TEXTAREA_CLASS}
    disabled={pending}
    bind:value={comment}
    placeholder="补充说明本次修改的背景、原因或注意事项。"
  ></textarea>
</label>

<div class="space-y-2">
  <span class="block text-sm">自动生成摘要</span>
  <p class="text-sm leading-7 text-(--color-fg-2)">{generatedSummary}</p>
</div>

<div class="action-row justify-end pt-2">
  <button
    class="action-button action-button-secondary"
    type="button"
    onclick={onReset}
    disabled={pending || (!hasSnapshotChanges && !comment.trim())}
  >
    重置
  </button>
  <button
    class="action-button action-button-primary"
    type="button"
    onclick={onSave}
    disabled={pending || !hasSnapshotChanges}
  >
    {pending ? '保存中...' : '保存修改'}
  </button>
</div>
