import type { FieldErrors } from './site-submission.types';

export function mapApiFieldErrors(fields: string[] | undefined): FieldErrors {
  if (!fields || fields.length === 0) {
    return {};
  }

  const mapped: FieldErrors = {};

  for (const field of fields) {
    const normalized = field.replace(/^site\./, '').replace(/^changes\./, '');

    if (normalized === 'main_tag_id' || normalized === 'sub_tags') {
      mapped.main_tag_id = '分类信息无效，请重新选择。';
      continue;
    }

    if (normalized === 'architecture') {
      mapped.architecture_program_name = '架构信息无效，请检查后重试。';
      continue;
    }

    if (normalized === 'feed') {
      mapped.feeds = '请检查订阅地址后重试。';
      continue;
    }

    mapped[normalized] = '请检查该字段后重试。';
  }

  return mapped;
}

export function formatAuditTime(value: string | null): string {
  if (!value) {
    return '尚未处理';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
