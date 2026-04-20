<script lang="ts">
  import { IconArrowRight, IconDice, IconRefresh } from '@tabler/icons-svelte-runes';
  import { onDestroy, onMount } from 'svelte';

  import { navigateToTrackedSite } from '@/application/site/site-access.client';
  import { resolveTone } from '@/application/site/site-card.shared';
  import type { SiteGoResult } from '@/application/site/site-directory.models';
  import {
    formatSiteDetailDateTime,
    resolveSiteDetailDescription,
  } from '@/components/site/site-detail.shared';
  import SiteTagRow from '@/components/site/SiteTagRow.svelte';

  let {
    result,
    currentHref,
    exampleQueries,
    feedback,
  }: {
    result: SiteGoResult;
    currentHref: string;
    exampleQueries: readonly string[];
    feedback: {
      title: string;
      summary: string;
    };
  } = $props();

  let remaining = $state(10);
  let timer = $state<ReturnType<typeof setInterval> | null>(null);

  const target = $derived(result.site);
  const hasPrompt = $derived(Boolean(result.failureReason) || !target);
  const tagTone = $derived(
    target ? resolveTone(target.primaryTag ?? '未分类', target.featured) : 'stone',
  );
  const infoItems = $derived.by(() =>
    target
      ? [
          {
            label: '地址',
            value: target.url,
          },
          {
            label: '主标签',
            value: target.primaryTag ?? '未记录',
          },
          {
            label: '副标签',
            value: target.subTags.length > 0 ? target.subTags.join(' / ') : '未记录',
          },
          {
            label: '加入时间',
            value: formatSiteDetailDateTime(target.joinTime),
          },
          {
            label: '更新时间',
            value: formatSiteDetailDateTime(target.updateTime),
          },
          {
            label: '文章数',
            value: String(target.articleCount),
          },
        ]
      : [],
  );

  function clearCountdown() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function goNow() {
    if (!target) {
      return;
    }

    clearCountdown();
    navigateToTrackedSite({
      siteId: target.id,
      href: target.url,
      source: 'SITE_GO',
      targetKind: 'SITE',
    });
  }

  onMount(() => {
    if (!target || result.failureReason) {
      return;
    }

    remaining = 10;
    timer = setInterval(() => {
      remaining -= 1;

      if (remaining <= 0) {
        goNow();
      }
    }, 1000);

    return () => {
      clearCountdown();
    };
  });

  onDestroy(() => {
    clearCountdown();
  });
</script>

<section class="page-section flex min-h-[calc(100vh-15rem)] items-center justify-center py-6">
  <div class="w-full max-w-232">
    <article
      class="rounded-[6px] border border-(--color-line-med) bg-(--color-bg) p-5 shadow-none sm:p-7"
    >
      <div class="flex items-start gap-4">
        <span
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-(--color-line-med) text-red-700 dark:text-red-400"
        >
          <IconDice size={18} stroke={1.9} class="block" />
        </span>

        <div class="min-w-0 flex-1">
          <p class="font-mono text-[11px] tracking-[0.18em] text-(--color-fg-3) uppercase">
            随机前往
          </p>

          {#if target && !hasPrompt}
            <h1
              class="mt-3 text-[clamp(2.2rem,6vw,4rem)] leading-[0.94] tracking-[-0.05em] text-(--color-fg)"
            >
              {target.name}
            </h1>
            <p class="mt-4 font-mono text-[12px] leading-6 text-(--color-fg-3)">
              {target.url}
            </p>
            <p class="mt-5 max-w-3xl text-[16px] leading-8 text-(--color-fg-2)">
              {resolveSiteDetailDescription(target.sign)}
            </p>

            <div class="mt-5">
              <SiteTagRow
                primaryTag={target.primaryTag}
                subTags={target.subTags}
                warningTags={target.warningTags}
                tone={tagTone}
              />
            </div>

            <dl
              class="mt-6 grid gap-4 border-t border-(--color-line) pt-5 text-sm text-(--color-fg-2) sm:grid-cols-2 lg:grid-cols-3"
            >
              {#each infoItems as item (item.label)}
                <div>
                  <dt class="font-mono text-[10px] tracking-[0.16em] text-(--color-fg-3) uppercase">
                    {item.label}
                  </dt>
                  <dd class="mt-2 break-all text-(--color-fg)">{item.value}</dd>
                </div>
              {/each}
            </dl>

            <div
              class="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-(--color-line) pt-5"
            >
              <div>
                <p class="font-mono text-[11px] tracking-[0.18em] text-(--color-fg-3) uppercase">
                  倒计时
                </p>
                <p
                  class="mt-2 text-[30px] leading-none font-medium tracking-[-0.04em] text-(--color-fg)"
                >
                  {remaining}s
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-3">
                <button
                  class="inline-flex items-center gap-2 rounded-md border border-red-700/20 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-700/35 hover:bg-(--color-bg-raised) dark:border-red-400/20 dark:text-red-400 dark:hover:border-red-400/35"
                  type="button"
                  onclick={goNow}
                >
                  <span>立即前往</span>
                  <IconArrowRight size={14} stroke={1.9} class="block" />
                </button>

                <a
                  class="inline-flex items-center gap-2 text-sm text-(--color-fg-2) transition hover:text-red-700 dark:hover:text-red-400"
                  href={currentHref}
                >
                  <span>重新随机</span>
                  <IconRefresh size={14} stroke={1.9} class="block" />
                </a>
              </div>
            </div>
          {:else}
            <h1
              class="mt-3 text-[clamp(2.2rem,6vw,4rem)] leading-[0.94] tracking-[-0.05em] text-(--color-fg)"
            >
              {feedback.title}
            </h1>
            <p class="mt-4 max-w-3xl text-[16px] leading-8 text-(--color-fg-2)">
              {feedback.summary}
            </p>

            <div class="mt-6 border-t border-(--color-line) pt-5">
              <p class="font-mono text-[11px] tracking-[0.18em] text-(--color-fg-3) uppercase">
                参数说明
              </p>
              <div class="mt-4 grid gap-3 text-sm leading-7 text-(--color-fg-2)">
                <p>`recommend=true` 表示仅在推荐站点中随机。</p>
                <p>`type=技术` 表示按主标签精确匹配后再随机跳转。</p>
                <p>可组合使用两个参数，示例：</p>
              </div>

              <div class="mt-4 flex flex-wrap gap-3">
                {#each exampleQueries as query (query)}
                  <a
                    class="inline-flex items-center rounded-md border border-(--color-line) px-3 py-2 text-sm transition hover:border-red-700/25 hover:text-red-700 dark:hover:border-red-400/25 dark:hover:text-red-400"
                    href={`/site/go${query}`}
                  >
                    {query}
                  </a>
                {/each}
              </div>

              {#if result.availableTypes.length > 0}
                <p
                  class="mt-6 font-mono text-[11px] tracking-[0.18em] text-(--color-fg-3) uppercase"
                >
                  可用主标签
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  {#each result.availableTypes as item (item)}
                    <span
                      class="rounded-md border border-(--color-line) px-3 py-1.5 text-sm text-(--color-fg-2)"
                    >
                      {item}
                    </span>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </article>
  </div>
</section>
