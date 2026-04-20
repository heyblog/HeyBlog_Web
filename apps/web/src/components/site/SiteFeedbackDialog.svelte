<script lang="ts">
  import type { SiteFeedbackPayload } from '@/application/site/site-directory.models';
  import ModalSurface from '@/shared/ui/ModalSurface.svelte';

  let {
    open = false,
    siteName,
    submitting = false,
    onSubmit,
    onCancel,
  }: {
    open?: boolean;
    siteName: string;
    submitting?: boolean;
    onSubmit?: (payload: SiteFeedbackPayload) => void;
    onCancel?: () => void;
  } = $props();

  const reasonOptions = [
    { value: 'SITE_INFO_ERROR', label: '站点信息错误' },
    { value: 'ACCESS_ISSUE', label: '访问异常' },
    { value: 'FEED_ISSUE', label: '订阅异常' },
    { value: 'CONTENT_RISK', label: '内容风险' },
    { value: 'COPYRIGHT', label: '版权问题' },
    { value: 'SPAM', label: '垃圾内容' },
    { value: 'OTHER', label: '其他问题' },
  ] as const;

  let reasonType = $state<string>('SITE_INFO_ERROR');
  let feedbackContent = $state('');
  let reporterName = $state('');
  let reporterEmail = $state('');
  let notifyByEmail = $state(false);

  function handleConfirm() {
    if (!feedbackContent.trim() || submitting) {
      return;
    }

    onSubmit?.({
      reasonType,
      feedbackContent: feedbackContent.trim(),
      reporterName: reporterName.trim() || null,
      reporterEmail: reporterEmail.trim() || null,
      notifyByEmail,
    });
  }

  $effect(() => {
    if (!open) {
      reasonType = 'SITE_INFO_ERROR';
      feedbackContent = '';
      reporterName = '';
      reporterEmail = '';
      notifyByEmail = false;
    }
  });
</script>

<ModalSurface
  {open}
  title="反馈站点问题"
  description={`向 ${siteName} 提交问题反馈。这里仅用于反馈站点问题，不会直接修改站点资料。`}
  confirmLabel={submitting ? '提交中…' : '提交反馈'}
  cancelLabel="取消"
  onConfirm={handleConfirm}
  {onCancel}
>
  <div class="space-y-4">
    <label class="block space-y-2">
      <span class="text-xs font-medium tracking-[0.08em] text-(--color-fg-3) uppercase"
        >问题类型</span
      >
      <select
        bind:value={reasonType}
        class="w-full rounded-md border border-(--color-line-med) bg-(--color-bg) px-3 py-2.5 text-sm text-(--color-fg) transition outline-none focus:border-(--color-info-dot)"
      >
        {#each reasonOptions as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>

    <label class="block space-y-2">
      <span class="text-xs font-medium tracking-[0.08em] text-(--color-fg-3) uppercase"
        >反馈内容</span
      >
      <textarea
        bind:value={feedbackContent}
        rows="5"
        placeholder="请写明问题现象、涉及链接或你观察到的具体情况。"
        class="w-full rounded-md border border-(--color-line-med) bg-(--color-bg) px-3 py-2.5 text-sm leading-6 text-(--color-fg) transition outline-none placeholder:text-(--color-fg-3) focus:border-(--color-info-dot)"
      ></textarea>
    </label>

    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block space-y-2">
        <span class="text-xs font-medium tracking-[0.08em] text-(--color-fg-3) uppercase"
          >联系人</span
        >
        <input
          bind:value={reporterName}
          placeholder="可选"
          class="w-full rounded-md border border-(--color-line-med) bg-(--color-bg) px-3 py-2.5 text-sm text-(--color-fg) transition outline-none placeholder:text-(--color-fg-3) focus:border-(--color-info-dot)"
        />
      </label>

      <label class="block space-y-2">
        <span class="text-xs font-medium tracking-[0.08em] text-(--color-fg-3) uppercase"
          >联系邮箱</span
        >
        <input
          bind:value={reporterEmail}
          inputmode="email"
          placeholder="可选"
          class="w-full rounded-md border border-(--color-line-med) bg-(--color-bg) px-3 py-2.5 text-sm text-(--color-fg) transition outline-none placeholder:text-(--color-fg-3) focus:border-(--color-info-dot)"
        />
      </label>
    </div>

    <label class="flex items-center gap-2 text-sm text-(--color-fg-2)">
      <input
        bind:checked={notifyByEmail}
        type="checkbox"
        class="size-4 rounded-sm border-(--color-line-med)"
      />
      <span>愿意通过邮箱接收处理通知</span>
    </label>
  </div>
</ModalSurface>
