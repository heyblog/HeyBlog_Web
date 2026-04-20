<script lang="ts">
  import type { TaskDetailEntry } from './task-job-detail.helpers';

  let {
    entries,
    columnsClass = 'md:grid-cols-2 xl:grid-cols-4',
  }: {
    entries: TaskDetailEntry[];
    columnsClass?: string;
  } = $props();
</script>

<dl class={`grid gap-x-4 gap-y-3 ${columnsClass}`}>
  {#each entries as entry (`${entry.label}:${entry.value}`)}
    <div class="rounded-[5px] bg-(--color-bg-raised) px-3 py-3">
      <dt class="text-xs text-(--color-fg-3)">{entry.label}</dt>
      <dd class="mt-1 text-sm break-all text-(--color-fg)">{entry.value}</dd>
    </div>
  {/each}
</dl>
