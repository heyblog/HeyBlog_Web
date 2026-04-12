<script lang="ts">
  import { submitAuditReviewAction } from '@/application/management/site-management.browser';
  import {
    createDraftFromSnapshot,
    toSnapshotPayload,
  } from '@/application/management/site-management.snapshot';
  import { formatAuditTime } from '@/application/site-submission/site-submission.service';
  import { openAlertDialog, openConfirmDialog } from '@/shared/browser/dialog.service';
  import { openToast } from '@/shared/browser/toast.service';

  import type { AuditDetail } from './site-audit-review.types';
  import SiteAuditActionViewPanel from './SiteAuditActionViewPanel.svelte';
  import SiteAuditReviewSidebar from './SiteAuditReviewSidebar.svelte';

  let {
    auditId,
    detail,
    options,
    mode = 'detail',
    initialStatus = null,
    initialMessage = null,
  }: {
    auditId: string;
    detail: AuditDetail;
    options: import('@/application/management/site-management.snapshot').SiteSubmissionOptions;
    mode?: 'detail' | 'process';
    initialStatus?: string | null;
    initialMessage?: string | null;
  } = $props();

  let manualComment = $state('');
  let correctionDraft = $state(createDraftFromSnapshot(null));
  let pending = $state(false);
  let formError = $state('');
  let announcedInitialFeedback = $state(false);
  let hydratedAuditId = $state<string | null>(null);

  const actionLabelMap: Record<string, string> = {
    CREATE: '新增',
    UPDATE: '修改',
    DELETE: '删除',
    RESTORE: '恢复',
  };

  const statusLabelMap: Record<string, string> = {
    PENDING: '待审核',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    CANCELED: '已取消',
  };

  const isPending = $derived(detail.status === 'PENDING');
  const isCreateOrUpdate = $derived(detail.action === 'CREATE' || detail.action === 'UPDATE');
  const canEditSnapshot = $derived(mode === 'process' && isPending && isCreateOrUpdate);
  const correctionHref = $derived(
    isPending && isCreateOrUpdate ? `/management/site-submissions/${auditId}/process` : null,
  );
  const showSummaryReason = $derived(
    detail.action === 'UPDATE' && Boolean(detail.submit_reason?.trim()),
  );

  $effect(() => {
    if (hydratedAuditId === auditId) {
      return;
    }

    hydratedAuditId = auditId;
    manualComment = detail.reviewer_comment ?? '';
    correctionDraft = createDraftFromSnapshot(detail.editable_snapshot);
  });

  const handleReview = async (decision: 'APPROVED' | 'REJECTED') => {
    formError = '';
    const normalizedComment = manualComment.trim();

    if (!isPending) {
      openToast({ tone: 'warning', title: '不可重复审核', message: '当前申请已处理。' });
      return;
    }

    if (decision === 'REJECTED' && !normalizedComment) {
      formError = '驳回时请填写审核意见。';
      return;
    }

    const confirmed = await openConfirmDialog({
      title:
        decision === 'APPROVED' && canEditSnapshot
          ? '确认按纠正后的信息通过该申请？'
          : decision === 'APPROVED'
            ? '确认通过该申请？'
            : '确认驳回该申请？',
      description:
        decision === 'APPROVED' && canEditSnapshot
          ? '将按当前纠正页中的内容覆盖本次申请的最终通过结果。'
          : decision === 'APPROVED'
            ? '通过后会立即写入正式站点数据。'
            : '驳回后将保留申请记录，不会改动正式站点数据。',
      tone: decision === 'APPROVED' ? 'warning' : 'danger',
      confirmLabel: decision === 'APPROVED' ? '确认通过' : '确认驳回',
      cancelLabel: '取消',
    });

    if (!confirmed) {
      return;
    }

    pending = true;
    const result = await submitAuditReviewAction(auditId, {
      decision,
      reviewer_comment: normalizedComment || null,
      ...(decision === 'APPROVED' && canEditSnapshot
        ? {
            snapshot_override: toSnapshotPayload(correctionDraft),
          }
        : {}),
    });
    pending = false;

    if (result.redirect) {
      window.location.assign(result.redirect);
      return;
    }

    if (!result.ok) {
      formError = result.message || '审核提交失败，请稍后重试。';
      openToast({ tone: 'error', title: '审核失败', message: formError });
      await openAlertDialog({
        title: '审核失败',
        description: formError,
        tone: 'danger',
        confirmLabel: '我知道了',
      });
      return;
    }

    openToast({
      tone: 'success',
      title: '审核完成',
      message: '审核结果已提交，正在刷新页面。',
    });

    window.setTimeout(() => {
      const target = new URL(`/management/site-submissions/${auditId}`, window.location.origin);
      target.searchParams.set('status', 'reviewed');
      window.location.assign(`${target.pathname}${target.search}`);
    }, 420);
  };

  $effect(() => {
    if (announcedInitialFeedback) {
      return;
    }

    if (initialMessage?.trim()) {
      announcedInitialFeedback = true;
      openToast({
        tone: 'error',
        title: '审核失败',
        message: initialMessage.trim(),
      });
      return;
    }

    if (initialStatus === 'reviewed') {
      announcedInitialFeedback = true;
      openToast({
        tone: 'success',
        title: '审核完成',
        message: '审核结果已更新。',
      });
    }
  });
</script>

<div class="space-y-4">
  <section class="page-section space-y-4">
    <div class="grid gap-3 md:grid-cols-2">
      <div>
        <p class="text-xs text-(--color-fg-3)">审核编号</p>
        <p class="mt-2 font-mono text-sm">{detail.id}</p>
      </div>
      <div>
        <p class="text-xs text-(--color-fg-3)">动作状态</p>
        <p class="mt-2 text-sm">
          {actionLabelMap[detail.action] ?? detail.action} / {statusLabelMap[detail.status] ??
            detail.status}
        </p>
      </div>
      <div>
        <p class="text-xs text-(--color-fg-3)">提交者</p>
        <p class="mt-2 text-sm">{detail.submitter_name ?? '匿名'}</p>
        <p class="mt-1 text-xs text-(--color-fg-3)">{detail.submitter_email ?? '无邮箱'}</p>
      </div>
      <div>
        <p class="text-xs text-(--color-fg-3)">申请时间</p>
        <p class="mt-2 text-sm">{formatAuditTime(detail.created_time)}</p>
      </div>
    </div>

    {#if showSummaryReason}
      <div>
        <p class="text-xs text-(--color-fg-3)">提交原因</p>
        <p class="mt-2 whitespace-pre-wrap text-sm leading-7">{detail.submit_reason}</p>
      </div>
    {/if}
  </section>

  <SiteAuditActionViewPanel
    {detail}
    {mode}
    {canEditSnapshot}
    {pending}
    bind:correctionDraft
    {options}
  />

  <SiteAuditReviewSidebar
    {mode}
    {isCreateOrUpdate}
    {isPending}
    {pending}
    {formError}
    bind:manualComment
    {correctionHref}
    onApprove={() => handleReview('APPROVED')}
    onReject={() => handleReview('REJECTED')}
  />
</div>
