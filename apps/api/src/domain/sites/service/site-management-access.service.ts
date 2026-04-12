import type { SiteAuditSnapshot } from '@zhblogs/db';

export const MANUAL_READ_ONLY_SITE_MANAGEMENT_FIELDS = [
  'bid',
  'icon_base64',
  'from',
  'reason',
] as const;

type ManualReadOnlySiteManagementField = (typeof MANUAL_READ_ONLY_SITE_MANAGEMENT_FIELDS)[number];

const normalizeOptionalString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(value.map((entry) => normalizeOptionalString(entry)).filter(Boolean) as string[]),
  ].sort((left, right) => left.localeCompare(right, 'zh-CN'));
};

const readComparableFieldValue = (
  snapshot: SiteAuditSnapshot | null | undefined,
  field: ManualReadOnlySiteManagementField,
): unknown => {
  if (!snapshot) {
    return field === 'from' ? [] : null;
  }

  switch (field) {
    case 'bid':
    case 'icon_base64':
    case 'reason':
      return normalizeOptionalString(snapshot[field]);
    case 'from':
      return normalizeStringList(snapshot.from);
    default:
      return null;
  }
};

export const listManualReadOnlySiteManagementFieldChanges = (
  current: SiteAuditSnapshot | null | undefined,
  next: SiteAuditSnapshot | null | undefined,
): ManualReadOnlySiteManagementField[] =>
  MANUAL_READ_ONLY_SITE_MANAGEMENT_FIELDS.filter(
    (field) =>
      JSON.stringify(readComparableFieldValue(current, field)) !==
      JSON.stringify(readComparableFieldValue(next, field)),
  );
