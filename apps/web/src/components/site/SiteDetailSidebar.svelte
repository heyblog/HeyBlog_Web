<script lang="ts">
  import { IconCopy, IconExternalLink, IconRss, IconSitemap } from '@tabler/icons-svelte-runes';

  import { trackSiteAccess } from '@/application/site/site-access.client';
  import type { SiteDetail } from '@/application/site/site-directory.models';
  import type { SiteResourceLink } from '@/components/site/site-detail.shared';
  import { formatSiteDetailDateTime } from '@/components/site/site-detail.shared';

  let {
    detail,
    resourceLinks,
    copiedKey = '',
    onCopy,
  }: {
    detail: SiteDetail;
    resourceLinks: SiteResourceLink[];
    copiedKey?: string;
    onCopy?: (key: string, value: string | null) => void;
  } = $props();

  function resolveTargetKind(kind: SiteResourceLink['kind']) {
    if (kind === 'rss') {
      return 'FEED' as const;
    }

    if (kind === 'sitemap') {
      return 'SITEMAP' as const;
    }

    return 'LINK_PAGE' as const;
  }
</script>

<aside class="min-w-0 pt-2 xl:border-l xl:border-(--color-line) xl:pl-8">
  <div class="space-y-6">
    <section>
      <p class="font-mono text-base tracking-[0.16em] text-(--color-fg-3) uppercase">站点信息</p>
      <dl class="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm text-(--color-fg-2)">
        <div>
          <dt class="font-mono text-[10px] tracking-[0.16em] text-(--color-fg-3) uppercase">
            加入时间
          </dt>
          <dd class="mt-1 text-(--color-fg)">{formatSiteDetailDateTime(detail.joinTime)}</dd>
        </div>
        <div>
          <dt class="font-mono text-[10px] tracking-[0.16em] text-(--color-fg-3) uppercase">
            更新时间
          </dt>
          <dd class="mt-1 text-(--color-fg)">{formatSiteDetailDateTime(detail.updateTime)}</dd>
        </div>
        <div>
          <dt class="font-mono text-[10px] tracking-[0.16em] text-(--color-fg-3) uppercase">
            文章数
          </dt>
          <dd class="mt-1 text-(--color-fg)">{detail.articleCount}</dd>
        </div>
        <div>
          <dt class="font-mono text-[10px] tracking-[0.16em] text-(--color-fg-3) uppercase">
            访问数
          </dt>
          <dd class="mt-1 text-(--color-fg)">{detail.visitCount}</dd>
        </div>
        <div>
          <dt class="font-mono text-[10px] tracking-[0.16em] text-(--color-fg-3) uppercase">
            访问范围
          </dt>
          <dd class="mt-1 text-(--color-fg)">{detail.accessScope}</dd>
        </div>
        <div>
          <dt class="font-mono text-[10px] tracking-[0.16em] text-(--color-fg-3) uppercase">
            程序信息
          </dt>
          <dd class="mt-1 text-(--color-fg)">{detail.architecture.program?.name ?? '未记录'}</dd>
        </div>
      </dl>

      {#if detail.reason}
        <div class="mt-5 border-t border-(--color-line) pt-4">
          <p class="text-(--color-fg-3)">备注</p>
          <p class="mt-1 text-sm leading-7 text-(--color-fg)">{detail.reason}</p>
        </div>
      {/if}
    </section>

    {#if resourceLinks.length > 0}
      <section class="border-t border-(--color-line) pt-5">
        <p class="font-mono text-base tracking-[0.16em] text-(--color-fg-3) uppercase">资源链接</p>
        <div class="mt-2">
          {#each resourceLinks as item, index (item.key)}
            <div
              class={`flex items-center justify-between gap-3 py-3 ${index > 0 ? 'border-t border-(--color-line)' : ''}`}
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-(--color-fg)">{item.label}</p>
                <p class="truncate text-sm text-(--color-fg-3)">{item.value}</p>
              </div>
              <div class="flex items-center gap-2">
                <a
                  class="text-(--color-fg-3) transition hover:text-(--color-fg)"
                  href={item.href}
                  rel="noreferrer"
                  target="_blank"
                  aria-label={`打开 ${item.label}`}
                  onclick={() => {
                    trackSiteAccess(detail.id, {
                      source: 'SITE_DETAIL',
                      targetKind: resolveTargetKind(item.kind),
                    });
                  }}
                >
                  {#if item.kind === 'rss'}
                    <IconRss size={16} stroke={1.8} />
                  {:else if item.kind === 'sitemap'}
                    <IconSitemap size={16} stroke={1.8} />
                  {:else}
                    <IconExternalLink size={16} stroke={1.8} />
                  {/if}
                </a>
                <button
                  class="text-(--color-fg-3) transition hover:text-(--color-fg)"
                  type="button"
                  onclick={() => onCopy?.(item.key, item.value)}
                  aria-label={`复制 ${item.label}`}
                >
                  <IconCopy size={16} stroke={1.8} />
                </button>
              </div>
            </div>
          {/each}
        </div>

        {#if copiedKey}
          <p class="mt-3 text-xs text-(--color-ok)">已复制到剪贴板。</p>
        {/if}
      </section>
    {/if}
  </div>
</aside>
