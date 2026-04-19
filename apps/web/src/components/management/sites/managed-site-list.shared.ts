export type ManagedSiteListItem = {
  id: string;
  bid: string | null;
  name: string;
  url: string;
  classification_status: 'COMPLETE' | 'NEEDS_REVIEW';
  access_scope: 'CN_ONLY' | 'NON_CN_ONLY' | 'ALL';
  status: 'OK' | 'WARNING' | 'ERROR';
  is_show: boolean;
  recommend: boolean;
  main_tag_id: string | null;
  main_tag_name: string | null;
  update_time: string;
};

export type SitePagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type ListOption = {
  value: string;
  label: string;
};

export type PaginationView = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  previousHref: string | null;
  nextHref: string | null;
  pages: Array<{
    page: number;
    href: string;
    isCurrent: boolean;
  }>;
};

export const BOOLEAN_FILTER_OPTIONS: ListOption[] = [
  { value: 'true', label: '是' },
  { value: 'false', label: '否' },
];

export const readOptionLabel = (options: ListOption[], value: string | null | undefined): string =>
  options.find((item) => item.value === value)?.label ?? value?.trim() ?? '—';

export const formatManagedSiteUpdateTime = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}年${month}月${day}日`;
};

export const readManagedSiteFlags = (
  entry: Pick<ManagedSiteListItem, 'is_show' | 'recommend'>,
): string => {
  const labels: string[] = [];

  if (!entry.is_show) {
    labels.push('隐藏');
  }

  if (entry.recommend) {
    labels.push('推荐站点');
  }

  return labels.join(' - ');
};
