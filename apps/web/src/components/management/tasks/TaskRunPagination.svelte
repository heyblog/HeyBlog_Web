<script lang="ts">
  let {
    total = 0,
    page = $bindable(1),
    pageSize = $bindable(10),
  }: {
    total?: number;
    page?: number;
    pageSize?: number;
  } = $props();

  let totalPages = $derived(Math.max(1, Math.ceil(total / Math.max(pageSize, 1))));

  $effect(() => {
    if (page > totalPages) {
      page = totalPages;
    }
    if (page < 1) {
      page = 1;
    }
  });

  function handlePageSizeChange(event: Event) {
    pageSize = Number((event.currentTarget as HTMLSelectElement).value);
    page = 1;
  }
</script>

<div class="flex flex-wrap items-center justify-between gap-3">
  <p class="text-xs text-(--color-fg-3)">共 {total} 条 · 第 {page} / {totalPages} 页</p>

  <div class="flex flex-wrap items-center gap-2">
    <select
      class="rounded-md border border-(--color-line) bg-(--color-bg-raised) px-3 py-2 text-sm text-(--color-fg)"
      value={String(pageSize)}
      onchange={handlePageSizeChange}
    >
      <option value="10">10 / 页</option>
      <option value="20">20 / 页</option>
      <option value="50">50 / 页</option>
    </select>

    <button
      class="rounded-md border border-(--color-line-med) px-3 py-2 text-sm"
      type="button"
      disabled={page <= 1}
      onclick={() => (page = Math.max(1, page - 1))}
    >
      上一页
    </button>

    <button
      class="rounded-md border border-(--color-line-med) px-3 py-2 text-sm"
      type="button"
      disabled={page >= totalPages}
      onclick={() => (page = Math.min(totalPages, page + 1))}
    >
      下一页
    </button>
  </div>
</div>
