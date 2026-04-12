<script lang="ts">
  import {
    WORKSPACE_SELECT_CHEVRON_STYLE,
    WORKSPACE_SELECT_CLASS,
    WORKSPACE_TEXTAREA_CLASS,
  } from '@/components/site-submission/site-submission-workspace.constants';
  import FormMessage from '@/shared/ui/FormMessage.svelte';

  export let auditId: string;
  export let detail: {
    created_time: string;
    reviewed_time: string | null;
  };
  export let mode: 'detail' | 'process' = 'detail';
  export let isCreateOrUpdate = false;
  export let isPending = false;
  export let canReviewHere = false;
  export let pending = false;
  export let formError = '';
  export let decision: 'APPROVED' | 'REJECTED' = 'APPROVED';
  export let manualComment = '';
  export let onReview: () => Promise<void> | void;
</script>

<aside class="page-section space-y-4">
  <div>
    <p class="text-xs text-[var(--color-fg-3)]">处理时间</p>
    <p class="mt-2 text-sm">创建：{detail.created_time}</p>
    <p class="mt-1 text-xs text-[var(--color-fg-3)]">完成：{detail.reviewed_time ?? '尚未处理'}</p>
  </div>

  {#if formError}
    <FormMessage tone="error" title="提交失败" message={formError} />
  {/if}

  {#if mode === 'process' && !isCreateOrUpdate}
    <FormMessage
      tone="warning"
      title="当前申请不支持此页面处理"
      message="独立审核页仅用于新增/修改申请，请返回详情页进行查看或处理。"
    />
    <a
      class="action-button action-button-ghost w-full justify-center"
      href={`/management/site-submissions/${auditId}`}
    >
      返回审核详情
    </a>
  {/if}

  {#if mode === 'detail' && isCreateOrUpdate && isPending}
    <a
      class="action-button action-button-ghost w-full justify-center"
      href={`/management/site-submissions/${auditId}/process`}
    >
      需要修改？前往修改页面
    </a>
  {/if}

  <div class="space-y-2">
    <label class="block text-sm font-medium" for="audit-decision">审核决定</label>
    <select
      id="audit-decision"
      class={WORKSPACE_SELECT_CLASS}
      style={WORKSPACE_SELECT_CHEVRON_STYLE}
      value={decision}
      disabled={pending || !canReviewHere}
      on:change={(event) =>
        (decision = (event.currentTarget as HTMLSelectElement).value as 'APPROVED' | 'REJECTED')}
    >
      <option value="APPROVED">通过</option>
      <option value="REJECTED">驳回</option>
    </select>
  </div>

  <div class="space-y-2">
    <label class="block text-sm font-medium" for="audit-manual-comment">审核备注（人工追加）</label>
    <textarea
      id="audit-manual-comment"
      class={WORKSPACE_TEXTAREA_CLASS}
      value={manualComment}
      disabled={pending || !canReviewHere}
      on:input={(event) => (manualComment = (event.currentTarget as HTMLTextAreaElement).value)}
    ></textarea>
  </div>

  <button
    class="action-button action-button-primary w-full"
    type="button"
    disabled={pending || !canReviewHere}
    on:click={() => void onReview?.()}
  >
    {#if !isPending}
      该申请已处理
    {:else if canReviewHere}
      {pending ? '提交中...' : '提交审核决定'}
    {:else}
      当前页面不可处理
    {/if}
  </button>
</aside>
