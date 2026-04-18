const SITE_AUDIT_FIELD_LABELS: Record<string, string> = {
  bid: '站点 BID',
  name: '站点名称',
  url: '站点地址',
  sign: '站点简介',
  icon_base64: '站点图标',
  feed: '订阅源',
  from: '来源渠道',
  classification_status: '分类状态',
  sitemap: '站点地图',
  link_page: '友链页面',
  access_scope: '访问范围',
  status: '站点状态',
  is_show: '展示开关',
  recommend: '推荐状态',
  reason: '备注原因',
  main_tag: '主分类',
  sub_tags: '子分类',
  architecture: '技术架构',
};

const SYSTEM_CORRECTION_NOTE_PREFIX = '【系统修正】审核员已修正字段：';

export const resolveSiteAuditFieldLabel = (field: string): string =>
  SITE_AUDIT_FIELD_LABELS[field] ?? field;

export const buildSystemCorrectionNote = (fields: string[]): string | null => {
  const labels = [...new Set(fields.map((field) => resolveSiteAuditFieldLabel(field)))];

  if (labels.length === 0) {
    return null;
  }

  return `${SYSTEM_CORRECTION_NOTE_PREFIX}${labels.join('、')}。`;
};

export const splitSystemCorrectionNote = (
  value: string | null | undefined,
): { systemNote: string | null; manualNote: string | null } => {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return {
      systemNote: null,
      manualNote: null,
    };
  }

  if (!normalized.startsWith(SYSTEM_CORRECTION_NOTE_PREFIX)) {
    return {
      systemNote: null,
      manualNote: normalized,
    };
  }

  const [firstLine, ...restLines] = normalized.split('\n');
  const manual = restLines.join('\n').trim();

  return {
    systemNote: firstLine?.trim() || null,
    manualNote: manual || null,
  };
};
