<script lang="ts">
  import type {
    AnnouncementArchiveItem,
    AnnouncementArchiveResult,
  } from '@/application/announcement/announcement.models';

  let { initialResult }: { initialResult: AnnouncementArchiveResult } = $props();

  const cloneResult = (value: AnnouncementArchiveResult): AnnouncementArchiveResult => ({
    items: value.items.map((item) => ({ ...item })),
    pagination: { ...value.pagination },
  });

  const formatDate = (value: string | null): string => {
    if (!value) {
      return '—';
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  let result = $derived(cloneResult(initialResult));
  let pending = $state(false);

  function syncPageUrl(page: number) {
    const url = new URL(window.location.href);

    if (page <= 1) {
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('page', String(page));
    }

    if (result.pagination.pageSize === 20) {
      url.searchParams.delete('pageSize');
    } else {
      url.searchParams.set('pageSize', String(result.pagination.pageSize));
    }

    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }

  async function loadPage(nextPage: number) {
    if (pending || nextPage < 1 || nextPage > result.pagination.totalPages) {
      return;
    }

    pending = true;

    try {
      const response = await fetch(
        `/api/announcements?page=${nextPage}&pageSize=${result.pagination.pageSize}`,
        {
          headers: {
            accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        ok: boolean;
        data: AnnouncementArchiveResult;
      };

      result = cloneResult(payload.data);
      syncPageUrl(payload.data.pagination.page);
    } finally {
      pending = false;
    }
  }

  const hasItems = $derived(result.items.length > 0);

  const renderStatus = (item: AnnouncementArchiveItem): string => {
    if (item.status === 'EXPIRED') {
      return '已归档';
    }

    if (item.expireTime) {
      const expireTime = new Date(item.expireTime);

      if (!Number.isNaN(expireTime.getTime()) && expireTime.getTime() <= Date.now()) {
        return '已归档';
      }
    }

    return '已发布';
  };
</script>

<div class="page-shell">
  <section class="page-stack">
    <section class="page-section">
      <div class="section-head">
        <div>
          <p class="eyebrow">
            <span class="status-dot" style="--status-dot: var(--color-info-dot)"></span>
            public / announcements
          </p>
          <h1 class="section-title">公告归档</h1>
        </div>
      </div>
    </section>

    <section class="page-section space-y-4">
      {#if hasItems}
        {#each result.items as item (item.id)}
          <article class="rounded-sm border border-(--color-line) p-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="inline-flex flex-wrap items-center gap-2 text-xs text-(--color-fg-3)">
                <span>{renderStatus(item)}</span>
              </div>
            </div>

            <h2 class="mt-4 text-xl font-medium tracking-[-0.02em]">{item.title}</h2>

            {#if item.content}
              <div class="mt-2 text-sm leading-7 whitespace-pre-wrap text-(--color-fg)">
                {item.content}
              </div>
            {/if}
            <div
              class="xs:flex-row xs:gap-2 mt-2 flex w-full flex-col justify-end space-y-1 text-xs text-(--color-fg-3)"
            >
              <p>开始时间：{formatDate(item.publishTime)}</p>
              <p>结束时间：{formatDate(item.expireTime)}</p>
            </div>
          </article>
        {/each}
      {:else}
        <div
          class="rounded-sm border border-dashed border-(--color-line-med) p-6 text-sm text-(--color-fg-3)"
        >
          当前还没有可以公开展示的公告。
        </div>
      {/if}

      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t border-(--color-line) pt-4 text-sm"
      >
        <p class="text-(--color-fg-3)">
          第 {result.pagination.page} / {result.pagination.totalPages} 页，共 {result.pagination
            .totalItems} 条
        </p>
        <div class="flex items-center gap-2">
          <button
            class="inline-flex items-center rounded-sm border border-(--color-line-med) px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending || result.pagination.page <= 1}
            onclick={() => loadPage(result.pagination.page - 1)}
            type="button"
          >
            上一页
          </button>
          <button
            class="inline-flex items-center rounded-sm border border-(--color-line-med) px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending || result.pagination.page >= result.pagination.totalPages}
            onclick={() => loadPage(result.pagination.page + 1)}
            type="button"
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  </section>
</div>
