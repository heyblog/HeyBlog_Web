<script lang="ts">
  import FormMessage from '@/shared/ui/FormMessage.svelte';

  import type { SiteCheckRunRecord } from './task-management.types';
  import { formatDateTime, readObject } from './task-management.types';
  import TaskDetailFieldGrid from './TaskDetailFieldGrid.svelte';

  type DetailEntry = { label: string; value: string };

  const toLabel = (key: string) =>
    key
      .split('_')
      .filter(Boolean)
      .map((item) => item[0]?.toUpperCase() + item.slice(1))
      .join(' ');

  const toValue = (value: unknown): string => {
    if (typeof value === 'string') return value.trim() || '—';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.length > 0 ? `${value.length} 项` : '—';
    if (value && typeof value === 'object') return '已记录';
    return '—';
  };

  const buildIssueEntries = (issue: Record<string, unknown>): DetailEntry[] =>
    Object.entries(issue)
      .map(([key, value]) => ({ label: toLabel(key), value: toValue(value) }))
      .filter((item) => item.value !== '—');

  const buildChangeEntries = (payload: Record<string, unknown>): DetailEntry[] =>
    Object.entries(payload)
      .map(([key, value]) => ({ label: toLabel(key), value: toValue(value) }))
      .filter((item) => item.value !== '—');

  const readIssues = (run: SiteCheckRunRecord): Record<string, unknown>[] => {
    const issues = readObject(run.content_validation_payload).issues;
    return Array.isArray(issues) ? issues.map((item) => readObject(item)) : [];
  };

  const readChanges = (run: SiteCheckRunRecord): Record<string, unknown> =>
    readObject(readObject(run.content_validation_payload).proposed_changes);

  const readAppliedCorrection = (run: SiteCheckRunRecord): boolean =>
    readObject(run.content_validation_payload).applied_correction === true;

  const buildSummaryEntries = (run: SiteCheckRunRecord): DetailEntry[] => {
    const issues = readIssues(run);
    const changes = readChanges(run);
    return [
      { label: '站点 ID', value: run.site_id },
      { label: '校验状态', value: run.content_validation_status ?? '—' },
      { label: '归并状态', value: run.derived_status ?? '—' },
      { label: '问题数', value: String(issues.length) },
      { label: '变更项数', value: String(Object.keys(changes).length) },
      { label: '已提交修正', value: readAppliedCorrection(run) ? '是' : '否' },
      { label: '完成时间', value: formatDateTime(run.finished_time) },
    ];
  };

  let { runs }: { runs: SiteCheckRunRecord[] } = $props();
  let validationRuns = $derived(
    runs.filter(
      (run) =>
        (run.content_validation_status ?? 'NOT_REQUESTED') !== 'NOT_REQUESTED' ||
        Object.keys(run.content_validation_payload).length > 0,
    ),
  );
</script>

<section class="rounded-md border border-(--color-line) bg-(--color-bg-raised) p-5">
  <div>
    <h2 class="text-base font-semibold text-(--color-fg)">内容校验结果</h2>
    <p class="mt-1 text-sm text-(--color-fg-3)">仅展示本次站点检测触发的链接校验与自动提审结果。</p>
  </div>

  {#if validationRuns.length === 0}
    <div class="mt-4">
      <FormMessage
        tone="info"
        eyebrow="VALIDATION"
        title="暂无内容校验结果"
        message="当前任务没有触发内容校验，或归并状态未达到可校验条件。"
      />
    </div>
  {:else}
    <div class="mt-4 divide-y divide-(--color-line)">
      {#each validationRuns as run (run.id)}
        <article class="space-y-4 py-4 first:pt-0 last:pb-0">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-sm font-medium text-(--color-fg)">{run.site_id}</h3>
            <span class="text-sm text-(--color-fg-2)">{run.content_validation_status ?? '—'}</span>
          </div>

          <TaskDetailFieldGrid
            entries={buildSummaryEntries(run)}
            columnsClass="md:grid-cols-2 xl:grid-cols-4"
          />

          {#if buildChangeEntries(readChanges(run)).length > 0}
            <section class="space-y-3 border-t border-dashed border-(--color-line) pt-4">
              <h4 class="text-sm font-medium text-(--color-fg)">拟提交修正</h4>
              <TaskDetailFieldGrid
                entries={buildChangeEntries(readChanges(run))}
                columnsClass="md:grid-cols-2 xl:grid-cols-4"
              />
            </section>
          {/if}

          {#if readIssues(run).length > 0}
            <section class="space-y-3 border-t border-dashed border-(--color-line) pt-4">
              <h4 class="text-sm font-medium text-(--color-fg)">校验问题</h4>
              <div class="space-y-3">
                {#each readIssues(run) as issue, index (`${run.id}-${index}`)}
                  <div class="border border-(--color-line) px-4 py-3">
                    <TaskDetailFieldGrid
                      entries={buildIssueEntries(issue)}
                      columnsClass="md:grid-cols-2 xl:grid-cols-4"
                    />
                  </div>
                {/each}
              </div>
            </section>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</section>
