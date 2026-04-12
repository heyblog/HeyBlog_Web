<script lang="ts">
  import { submitAuditReviewAction } from '@/application/management/site-management.browser';
  import {
    createDraftFromSnapshot,
    toSnapshotPayload,
  } from '@/application/management/site-management.snapshot';
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

  let decision = $state<'APPROVED' | 'REJECTED'>('APPROVED');
  let manualComment = $state('');
  let correctionDraft = $state(createDraftFromSnapshot(null));
  let pending = $state(false);
  let formError = $state('');
  let announcedInitialFeedback = $state(false);
  let hydratedAuditId = $state<string | null>(null);

  const isPending = $derived(detail.status === 'PENDING');
  const isCreateOrUpdate = $derived(detail.action === 'CREATE' || detail.action === 'UPDATE');
  const canEditSnapshot = $derived(mode === 'process' && isPending && isCreateOrUpdate);
  const canReviewHere = $derived(
    isPending && (mode === 'detail' || (mode === 'process' && isCreateOrUpdate)),
  );

  $effect(() => {
    if (hydratedAuditId === auditId) {
      return;
    }

    hydratedAuditId = auditId;
    manualComment = detail.reviewer_comment ?? '';
    correctionDraft = createDraftFromSnapshot(detail.editable_snapshot);
  });

  const handleReview = async () => {
    formError = '';

    if (!isPending) {
      openToast({ tone: 'warning', title: '不可重复审核', message: '当前申请已处理。' });
      return;
    }

    if (!canReviewHere) {
      openToast({
        tone: 'warning',
        title: '请前往对应页面处理',
        message: mode === 'process' ? '当前申请请在详情页处理。' : '当前申请不可在此页面处理。',
      });
      return;
    }

    const confirmed = await openConfirmDialog({
      title: decision === 'APPROVED' ? '确认通过该申请？' : '确认驳回该申请？',
      description:
        decision === 'APPROVED'
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
      reviewer_comment: manualComment.trim() || null,
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
      const target =
        mode === 'process'
          ? new URL(`/management/site-submissions/${auditId}`, window.location.origin)
          : new URL(window.location.href);
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

<div class="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_24rem]">
  <SiteAuditActionViewPanel
    {detail}
    {mode}
    {canEditSnapshot}
    {pending}
    {decision}
    bind:correctionDraft
    {options}
  />

  <SiteAuditReviewSidebar
    {auditId}
    {detail}
    {mode}
    {isCreateOrUpdate}
    {isPending}
    {canReviewHere}
    {pending}
    {formError}
    bind:decision
    bind:manualComment
    onReview={handleReview}
  />
</div>
