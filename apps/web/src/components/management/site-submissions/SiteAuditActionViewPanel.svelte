<script lang="ts">
  import type {
    SiteSnapshotDraft,
    SiteSubmissionOptions,
  } from '@/application/management/site-management.snapshot';
  import FormMessage from '@/shared/ui/FormMessage.svelte';

  import SiteSnapshotEditor from '../sites/SiteSnapshotEditor.svelte';

  import type { AuditDetail } from './site-audit-review.types';

  export let detail: AuditDetail;
  export let mode: 'detail' | 'process' = 'detail';
  export let canEditSnapshot = false;
  export let pending = false;
  export let decision: 'APPROVED' | 'REJECTED' = 'APPROVED';
  export let correctionDraft: SiteSnapshotDraft;
  export let options: SiteSubmissionOptions;

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

  const isInlineTagField = (field: string) => field === 'main_tag' || field === 'sub_tags';
</script>

<article class="page-section space-y-4">
  <div class="grid gap-3 md:grid-cols-2">
    <div>
      <p class="text-xs text-(--color-fg-3)">审核编号</p>
      <p class="mt-2 font-mono text-sm">{detail.id}</p>
    </div>
    <div>
      <p class="text-xs text-(--color-fg-3)">动作 / 状态</p>
      <p class="mt-2 text-sm">
        {actionLabelMap[detail.action] ?? detail.action} / {statusLabelMap[detail.status] ??
          detail.status}
      </p>
    </div>
    <div>
      <p class="text-xs text-(--color-fg-3)">站点</p>
      <p class="mt-2 text-sm">{detail.site_name ?? '未命名站点'}</p>
    </div>
    <div>
      <p class="text-xs text-(--color-fg-3)">提交者</p>
      <p class="mt-2 text-sm">{detail.submitter_name ?? '匿名'}</p>
      <p class="mt-1 text-xs text-(--color-fg-3)">{detail.submitter_email ?? '无邮箱'}</p>
    </div>
  </div>

  <div>
    <p class="text-xs text-(--color-fg-3)">提交原因</p>
    <p class="mt-2 text-sm leading-7">{detail.submit_reason ?? '—'}</p>
  </div>

  {#if detail.action_view.kind === 'UPDATE' && mode === 'detail'}
    <section class="space-y-3">
      <h3 class="text-sm font-medium">字段差异（旧值 / 新值）</h3>
      {#if (detail.action_view.changes?.length ?? 0) === 0}
        <p class="text-sm text-(--color-fg-3)">没有可展示的差异字段。</p>
      {/if}
      {#each detail.action_view.changes ?? [] as change (change.field)}
        <article class="rounded-sm border border-(--color-line)">
          <header class="border-b border-(--color-line) px-4 py-3 text-sm font-medium">
            {change.label}
          </header>
          <div class="space-y-2 p-3">
            <div
              class="rounded-sm border border-[color-mix(in_srgb,var(--color-fail)_30%,var(--color-line))] bg-[color-mix(in_srgb,var(--color-fail)_7%,transparent)] px-3 py-2"
            >
              <p class="text-[11px] uppercase tracking-[0.18em] text-(--color-fg-3)">旧值</p>
              {#if isInlineTagField(change.field)}
                <p class="mt-2 overflow-x-auto whitespace-nowrap text-xs">
                  {change.before_display || '—'}
                </p>
              {:else}
                <pre class="mt-2 whitespace-pre-wrap text-xs">{change.before_display || '—'}</pre>
              {/if}
            </div>
            <div
              class="rounded-sm border border-[color-mix(in_srgb,var(--color-ok)_30%,var(--color-line))] bg-[color-mix(in_srgb,var(--color-ok)_8%,transparent)] px-3 py-2"
            >
              <p class="text-[11px] uppercase tracking-[0.18em] text-(--color-fg-3)">新值</p>
              {#if isInlineTagField(change.field)}
                <p class="mt-2 overflow-x-auto whitespace-nowrap text-xs">
                  {change.after_display || '—'}
                </p>
              {:else}
                <pre class="mt-2 whitespace-pre-wrap text-xs">{change.after_display || '—'}</pre>
              {/if}
            </div>
          </div>
        </article>
      {/each}
    </section>
  {/if}

  {#if detail.action_view.kind === 'CREATE'}
    <section class="space-y-3">
      <h3 class="text-sm font-medium">提交数据</h3>
      <div class="rounded-sm border border-(--color-line)">
        <dl class="divide-y divide-(--color-line)">
          {#each detail.action_view.submitted_fields ?? [] as item (item.field)}
            <div class="grid gap-2 px-4 py-3 md:grid-cols-[11rem_minmax(0,1fr)]">
              <dt class="text-xs text-(--color-fg-3)">{item.label}</dt>
              <dd
                class={isInlineTagField(item.field)
                  ? 'text-sm overflow-x-auto whitespace-nowrap'
                  : 'text-sm whitespace-pre-wrap break-all'}
              >
                {item.value_display || '—'}
              </dd>
            </div>
          {/each}
        </dl>
      </div>
    </section>
  {/if}

  {#if detail.action_view.kind === 'DELETE'}
    <section class="space-y-3">
      <h3 class="text-sm font-medium">删除申请说明</h3>
      <FormMessage
        tone="warning"
        title="本次删除不展示字段 diff"
        message={detail.action_view.reason ?? detail.submit_reason ?? '未填写原因。'}
      />
    </section>
  {/if}

  {#if detail.action_view.kind === 'RESTORE'}
    <section class="space-y-3">
      <h3 class="text-sm font-medium">恢复申请说明</h3>
      <FormMessage
        tone="info"
        title="审核通过后会重新恢复站点公开展示"
        message={detail.submit_reason ?? '未填写恢复说明。'}
      />
    </section>
  {/if}

  {#if canEditSnapshot}
    <section class="space-y-3 border-t border-(--color-line) pt-5">
      <h3 class="text-sm font-medium">审核员纠正区（结构化）</h3>
      <p class="text-xs text-(--color-fg-3) leading-6">
        审核通过时，会把这里的内容作为最终落库快照；如果你修正了字段，系统会保留原申请，并额外记录最终生效的留痕。
      </p>
      <div class="rounded-md border border-(--color-line-med) p-5 sm:px-10 sm:py-8">
        <SiteSnapshotEditor
          bind:draft={correctionDraft}
          {options}
          disabled={pending || decision !== 'APPROVED'}
          idPrefix="audit-correction"
        />
      </div>
    </section>
  {/if}
</article>
