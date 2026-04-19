import type { TaskRequestConfigRecord } from './task-management.types';

export type ManualTaskKey = 'SITE_CHECK' | 'RSS_FETCH';

const appendRequestConfig = (payload: Record<string, unknown>, requestConfigId: string) =>
  requestConfigId.trim() ? { ...payload, request_config_id: requestConfigId.trim() } : payload;

export const pickDefaultRequestConfigId = (
  kind: ManualTaskKey,
  requestConfigs: TaskRequestConfigRecord[],
): string => requestConfigs.find((item) => item.task_type === kind && item.is_enabled)?.id ?? '';

export const buildManualSiteCheckPayload = (
  siteId: string,
  requestConfigId: string,
  runContentValidation: boolean,
  runGlobalCheck: boolean,
): Record<string, unknown> =>
  appendRequestConfig(
    {
      site_id: siteId.trim(),
      run_content_validation: runContentValidation,
      run_global_check: runGlobalCheck,
    },
    requestConfigId,
  );

export const buildManualRSSFetchPayload = (
  siteId: string,
  requestConfigId: string,
  feedMode: string,
  feedUrl: string,
): Record<string, unknown> =>
  appendRequestConfig(
    {
      site_id: siteId.trim(),
      feed_mode: feedMode || 'DEFAULT_ONLY',
      ...(feedUrl.trim() ? { feed_url: feedUrl.trim() } : {}),
    },
    requestConfigId,
  );
