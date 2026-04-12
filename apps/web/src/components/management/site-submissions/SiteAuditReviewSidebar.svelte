<script lang="ts">
  import { WORKSPACE_TEXTAREA_CLASS } from '@/components/site-submission/site-submission-workspace.constants';
  import FormMessage from '@/shared/ui/FormMessage.svelte';

  export let correctionHref: string | null = null;
  export let isCreateOrUpdate = false;
  export let isPending = false;
  export let mode: 'detail' | 'process' = 'detail';
  export let pending = false;
  export let formError = '';
  export let manualComment = '';
  export let onApprove: () => Promise<void> | void;
  export let onReject: () => Promise<void> | void;
</script>

<section class="page-section space-y-4">
  <div class="space-y-2">
    <label class="block text-sm font-medium" for="audit-manual-comment">审核意见</label>
    <textarea
      id="audit-manual-comment"
      class={WORKSPACE_TEXTAREA_CLASS}
      value={manualComment}
      disabled={pending || !isPending}
      on:input={(event) => (manualComment = (event.currentTarget as HTMLTextAreaElement).value)}
      placeholder="通过可不填，驳回时必填。"
    ></textarea>
  </div>

  {#if formError}
    <FormMessage tone="error" title="提交失败" message={formError} />
  {/if}

  {#if !isPending}
    <FormMessage tone="info" title="该申请已处理" message="当前页面不再允许继续审核。" />
  {/if}

  <div class="flex flex-wrap gap-3">
    {#if mode === 'detail' && isPending && isCreateOrUpdate && correctionHref}
      <a class="action-button action-button-secondary" href={correctionHref}> 信息纠正 </a>
    {/if}

    <button
      class="action-button action-button-primary"
      type="button"
      disabled={pending || !isPending}
      on:click={() => void onApprove?.()}
    >
      {pending ? '提交中...' : '审核通过'}
    </button>

    <button
      class="action-button action-button-danger"
      type="button"
      disabled={pending || !isPending}
      on:click={() => void onReject?.()}
    >
      {pending ? '提交中...' : '审核驳回'}
    </button>
  </div>
</section>
