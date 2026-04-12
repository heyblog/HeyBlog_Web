import type { SiteAuditActionKey, SiteAuditDiffItem } from '@zhblogs/db';

export const APPROVED_SITE_AUDIT_ACTIONS: SiteAuditActionKey[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
];

const SITE_AUDIT_ACTION_LABELS: Record<SiteAuditActionKey, string> = {
  CREATE: '新增',
  UPDATE: '修改',
  DELETE: '删除',
  RESTORE: '恢复',
};

const SITE_AUDIT_FIELD_LABELS: Record<string, string> = {
  name: '站点名称',
  url: '站点地址',
  sign: '站点简介',
  feed: '订阅地址',
  sitemap: '网站地图',
  link_page: '友链页面',
  main_tag: '主分类',
  sub_tags: '子分类',
  architecture: '程序与技术栈',
  bid: '站点 BID',
  from: '来源渠道',
  access_scope: '访问范围',
  status: '站点状态',
  is_show: '前台显示',
  recommend: '推荐站点',
  reason: '备注原因',
};

export function summarizeSiteAuditChange(
  action: SiteAuditActionKey,
  diff: SiteAuditDiffItem[] | null | undefined,
): string {
  if (action !== 'UPDATE') {
    return `${SITE_AUDIT_ACTION_LABELS[action]}站点记录`;
  }

  const changedLabels = (diff ?? [])
    .map((item) => SITE_AUDIT_FIELD_LABELS[item.field] ?? item.field)
    .filter((value, index, all) => all.indexOf(value) === index);

  if (changedLabels.length === 0) {
    return '修改站点信息';
  }

  if (changedLabels.length <= 3) {
    return `修改 ${changedLabels.join('、')}`;
  }

  return `修改 ${changedLabels.slice(0, 3).join('、')} 等 ${changedLabels.length} 项`;
}
