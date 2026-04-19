<script lang="ts">
  import { onMount } from 'svelte';

  import { fetchTaskJobDetailAction } from '@/application/management/task-management.browser';
  import FormMessage from '@/shared/ui/FormMessage.svelte';

  import {
    buildOverviewEntries,
    buildResultEntries,
    buildTaskProgress,
  } from './task-job-detail.helpers';
  import { readJobDetailRecord } from './task-management.helpers';
  import type { TaskJobDetailRecord } from './task-management.types';
  import TaskContentValidationSection from './TaskContentValidationSection.svelte';
  import TaskDetailFieldGrid from './TaskDetailFieldGrid.svelte';
  import TaskJobRetryChainSection from './TaskJobRetryChainSection.svelte';
  import TaskProgressSummary from './TaskProgressSummary.svelte';
  import TaskRSSFetchRunSection from './TaskRSSFetchRunSection.svelte';
  import TaskSectionTabs from './TaskSectionTabs.svelte';
  import TaskSiteCheckRunSection from './TaskSiteCheckRunSection.svelte';
  import TaskUpstreamSyncRunSection from './TaskUpstreamSyncRunSection.svelte';

  type Props = {
    jobId: string;
    returnTo: string;
    initialJob: TaskJobDetailRecord | null;
    initialError: string;
  };

  let { jobId, returnTo, initialJob, initialError }: Props = $props();
  let initialized = false;
  let job = $state<TaskJobDetailRecord | null>(null);
  let error = $state('');
  let refreshing = $state(false);
  let activeTab = $state<'overview' | 'runs' | 'retryChain' | 'validation'>('overview');
  let progress = $derived(job ? buildTaskProgress(job) : null);
  let exportHref = $derived(`/api/management/tasks/jobs/${jobId}/export.xls`);
  let resultEntries = $derived(job ? buildResultEntries(job) : []);
  let runCount = $derived(
    job
      ? (job.site_check_runs?.length ?? 0) +
          (job.rss_fetch_runs?.length ?? 0) +
          (job.upstream_sync_runs?.length ?? 0)
      : 0,
  );
  let retryCount = $derived(job?.retry_chain?.length ?? 0);
  let validationCount = $derived(
    job?.site_check_runs?.filter(
      (run) =>
        (run.content_validation_status ?? 'NOT_REQUESTED') !== 'NOT_REQUESTED' ||
        Object.keys(run.content_validation_payload).length > 0,
    ).length ?? 0,
  );
  let hasValidationTab = $derived(job?.task_type === 'SITE_CHECK');
  let tabItems = $derived([
    { key: 'overview', label: '概览', description: '任务摘要与结果。', count: 1 },
    { key: 'runs', label: '运行记录', description: '本次 job 产生的运行明细。', count: runCount },
    {
      key: 'retryChain',
      label: '重试链路',
      description: '旧 job 与新 job 的链路关系。',
      count: retryCount,
    },
    ...(hasValidationTab
      ? [
          {
            key: 'validation',
            label: '校验结果',
            description: '站点内容校验与提审结果。',
            count: validationCount,
          },
        ]
      : []),
  ]);

  $effect(() => {
    if (initialized) {
      return;
    }

    job = initialJob;
    error = initialError;
    initialized = true;
  });

  async function refreshDetail() {
    refreshing = true;
    const result = await fetchTaskJobDetailAction(jobId);
    if (!result.ok || !result.data) {
      error = result.message;
      refreshing = false;
      return;
    }

    job = readJobDetailRecord(result.data);
    error = '';
    refreshing = false;
  }

  $effect(() => {
    if (activeTab === 'validation' && !hasValidationTab) {
      activeTab = 'overview';
    }
  });

  onMount(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void refreshDetail();
      }
    }, 10000);

    return () => window.clearInterval(timer);
  });
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <a class="rounded-md border border-(--color-line-med) px-4 py-2 text-sm" href={returnTo}
        >返回任务中心</a
      >
      {#if job}
        <a class="rounded-md border border-(--color-line-med) px-4 py-2 text-sm" href={exportHref}>
          导出 Excel
        </a>
      {/if}
    </div>
    <button
      class="rounded-md border border-(--color-line-med) px-4 py-2 text-sm"
      type="button"
      onclick={refreshDetail}
    >
      {refreshing ? '刷新中…' : '刷新'}
    </button>
  </div>

  {#if error}
    <FormMessage tone="error" eyebrow="TASK DETAIL" title="任务详情加载失败" message={error} />
  {:else if job}
    <TaskSectionTabs
      items={tabItems}
      activeKey={activeTab}
      ariaLabel="任务详情选项卡"
      onSelect={(key) => (activeTab = key as typeof activeTab)}
    />

    {#if activeTab === 'overview'}
      <section class="rounded-md border border-(--color-line) bg-(--color-bg-raised) p-5">
        <h2 class="text-base font-semibold text-(--color-fg)">任务概览</h2>
        <div class="mt-4">
          <TaskDetailFieldGrid entries={buildOverviewEntries(job)} />
        </div>
      </section>

      {#if progress || resultEntries.length > 0}
        <TaskProgressSummary summary={progress} entries={resultEntries} />
      {/if}
    {:else if activeTab === 'runs'}
      {#if job.site_check_runs && job.site_check_runs.length > 0}
        <TaskSiteCheckRunSection runs={job.site_check_runs} />
      {/if}
      {#if job.rss_fetch_runs && job.rss_fetch_runs.length > 0}
        <TaskRSSFetchRunSection runs={job.rss_fetch_runs} />
      {/if}
      {#if job.upstream_sync_runs && job.upstream_sync_runs.length > 0}
        <TaskUpstreamSyncRunSection runs={job.upstream_sync_runs} />
      {/if}
      {#if runCount === 0}
        <FormMessage
          tone="info"
          eyebrow="RUNS"
          title="暂无运行记录"
          message="当前任务还没有生成运行明细。"
        />
      {/if}
    {:else if activeTab === 'retryChain'}
      <TaskJobRetryChainSection jobs={job.retry_chain ?? []} currentJobId={job.id} {returnTo} />
    {:else}
      <TaskContentValidationSection runs={job.site_check_runs ?? []} />
    {/if}
  {/if}
</div>
