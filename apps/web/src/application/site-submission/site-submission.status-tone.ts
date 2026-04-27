import { AUDIT_STATUS_META } from './site-submission.service';

export function statusToneClass(status: string): string {
  const meta = AUDIT_STATUS_META[status] ?? AUDIT_STATUS_META.PENDING;

  if (meta.tone === 'ok') {
    return 'border-[color-mix(in_srgb,var(--color-ok)_24%,var(--color-line))] text-(--color-ok)';
  }

  if (meta.tone === 'warn') {
    return 'border-[color-mix(in_srgb,var(--color-fail)_24%,var(--color-line))] text-(--color-fail)';
  }

  if (meta.tone === 'muted') {
    return 'border-(--color-line-med) text-(--color-fg-3)';
  }

  return 'border-[color-mix(in_srgb,var(--color-info)_24%,var(--color-line))] text-(--color-info)';
}
