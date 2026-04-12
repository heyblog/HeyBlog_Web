<script lang="ts">
  import { submitSiteUpdateAction } from '@/application/management/site-management.browser';
  import {
    cloneDraft,
    createDraftFromSnapshot,
    type SiteAuditSnapshot,
    type SiteSubmissionOptions,
    toSnapshotPayload,
  } from '@/application/management/site-management.snapshot';
  import { openAlertDialog } from '@/shared/browser/dialog.service';
  import { openToast } from '@/shared/browser/toast.service';
  import FormMessage from '@/shared/ui/FormMessage.svelte';

  import type { SiteHistoryItem } from './managed-site-history.shared';
  import ManagedSiteHistoryPanel from './ManagedSiteHistoryPanel.svelte';
  import ManagementReadonlyFieldsPanel from './ManagementReadonlyFieldsPanel.svelte';
  import SiteEditorActionsPanel from './SiteEditorActionsPanel.svelte';
  import SiteSnapshotEditor from './SiteSnapshotEditor.svelte';

  let {
    siteId,
    initialSnapshot,
    options,
    history = [],
  }: {
    siteId: string;
    initialSnapshot: SiteAuditSnapshot;
    options: SiteSubmissionOptions;
    history?: SiteHistoryItem[];
  } = $props();

  type SiteDraft = ReturnType<typeof createDraftFromSnapshot>;
  type SummaryField =
    | 'name'
    | 'url'
    | 'sign'
    | 'feed'
    | 'sitemap'
    | 'link_page'
    | 'main_tag'
    | 'sub_tags'
    | 'architecture'
    | 'bid'
    | 'from'
    | 'access_scope'
    | 'status'
    | 'is_show'
    | 'recommend'
    | 'reason';

  const SUMMARY_FIELD_LABELS: Record<SummaryField, string> = {
    name: '站点名称',
    url: '站点地址',
    sign: '站点简介',
    feed: '订阅地址',
    sitemap: '网站地图',
    link_page: '友链页面',
    main_tag: '主分类',
    sub_tags: '子分类',
    architecture: '程序与技术栈',
    bid: '站点 BID',
    from: '来源渠道',
    access_scope: '访问范围',
    status: '站点状态',
    is_show: '前台显示',
    recommend: '推荐站点',
    reason: '备注原因',
  };

  const SUMMARY_FIELDS: SummaryField[] = [
    'name',
    'url',
    'sign',
    'feed',
    'sitemap',
    'link_page',
    'main_tag',
    'sub_tags',
    'architecture',
    'bid',
    'from',
    'access_scope',
    'status',
    'is_show',
    'recommend',
    'reason',
  ];

  const createInitialDraft = (): SiteDraft => cloneDraft(createDraftFromSnapshot(initialSnapshot));

  let draft = $state<SiteDraft>(createInitialDraft());
  let comment = $state('');
  let pending = $state(false);
  let formError = $state('');
  const commentFieldId = 'site-editor-change-summary';

  const listChangedSummaryLabels = (
    currentSnapshot: SiteAuditSnapshot,
    nextSnapshot: SiteAuditSnapshot,
  ): string[] =>
    SUMMARY_FIELDS.filter(
      (field) =>
        JSON.stringify(currentSnapshot[field] ?? null) !==
        JSON.stringify(nextSnapshot[field] ?? null),
    ).map((field) => SUMMARY_FIELD_LABELS[field]);

  const summarizeSiteChange = (
    currentSnapshot: SiteAuditSnapshot,
    nextSnapshot: SiteAuditSnapshot,
  ): string => {
    const changedLabels = listChangedSummaryLabels(currentSnapshot, nextSnapshot);

    if (changedLabels.length === 0) {
      return '修改站点信息';
    }

    if (changedLabels.length <= 3) {
      return `修改 ${changedLabels.join('、')}`;
    }

    return `修改 ${changedLabels.slice(0, 3).join('、')} 等 ${changedLabels.length} 项`;
  };

  const resetEditor = (): void => {
    draft = createInitialDraft();
    comment = '';
    formError = '';
  };

  const handleSave = async (): Promise<void> => {
    formError = '';

    if (!hasSnapshotChanges) {
      openToast({
        tone: 'warning',
        title: '没有可保存的变更',
        message: '请先修改站点信息后再保存。',
      });
      return;
    }

    pending = true;
    const result = await submitSiteUpdateAction(siteId, {
      snapshot: currentPayload,
      comment: comment.trim() || null,
    });
    pending = false;

    if (result.redirect) {
      window.location.assign(result.redirect);
      return;
    }

    if (!result.ok) {
      formError = result.message || '站点更新失败，请稍后重试。';
      openToast({ tone: 'error', title: '保存失败', message: formError });
      await openAlertDialog({
        title: '保存失败',
        description: formError,
        tone: 'danger',
        confirmLabel: '我知道了',
      });
      return;
    }

    openToast({
      tone: 'success',
      title: '保存成功',
      message: '站点信息已更新，正在刷新页面。',
    });

    window.setTimeout(() => {
      window.location.reload();
    }, 320);
  };

  let initialPayload = $derived(toSnapshotPayload(createInitialDraft()));
  let currentPayload = $derived(toSnapshotPayload(draft));
  let generatedSummary = $derived(summarizeSiteChange(initialPayload, currentPayload));
  let hasSnapshotChanges = $derived(
    JSON.stringify(initialPayload) !== JSON.stringify(currentPayload),
  );
</script>

<div class="space-y-5">
  <section class="page-section space-y-4 pt-0">
    {#if formError}
      <FormMessage tone="error" title="提交失败" message={formError} />
    {/if}

    <div class="space-y-6 rounded-md border border-(--color-line-med) p-5 sm:px-10 sm:py-8">
      <SiteSnapshotEditor
        bind:draft
        {options}
        disabled={pending}
        idPrefix="site-editor"
        showReadonly={false}
      />
      <SiteEditorActionsPanel
        bind:comment
        {generatedSummary}
        {pending}
        {hasSnapshotChanges}
        {commentFieldId}
        onReset={resetEditor}
        onSave={handleSave}
      />

      <ManagementReadonlyFieldsPanel {draft} />
    </div>
  </section>
  <ManagedSiteHistoryPanel {history} />
</div>
