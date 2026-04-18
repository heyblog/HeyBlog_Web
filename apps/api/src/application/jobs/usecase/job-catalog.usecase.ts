import {
  JOB_STATUSES,
  JOB_TRIGGER_SOURCES,
  REQUEST_RETRY_STRATEGIES,
  REQUEST_TARGET_KINDS,
  RSS_FEED_MODES,
  SCHEDULE_MODES,
  TASK_TYPES,
  type TaskTypeKey,
} from '@zhblogs/db';

type ManualPreset = {
  id: string;
  name: string;
  task_type: TaskTypeKey;
  payload_template: Record<string, unknown>;
};

const MANUAL_PRESETS: ManualPreset[] = [
  {
    id: 'manual:site-check',
    name: '单站点状态检测',
    task_type: 'SITE_CHECK',
    payload_template: {
      target: {
        kind: 'SITE',
        site_id: '',
      },
      options: {
        run_content_validation: true,
        run_global_check: false,
        source: 'manual',
      },
    },
  },
  {
    id: 'manual:rss-fetch',
    name: '单站点 RSS 抓取',
    task_type: 'RSS_FETCH',
    payload_template: {
      target: {
        kind: 'SITE',
        site_id: '',
      },
      options: {
        feed_mode: 'DEFAULT_ONLY',
        source: 'manual',
      },
    },
  },
  {
    id: 'manual:upstream-sync',
    name: '手动上游同步',
    task_type: 'UPSTREAM_SYNC',
    payload_template: {},
  },
];

const toCatalogRows = <T extends string>(
  record: Record<T, { label: string; description: string }>,
) =>
  (Object.keys(record) as T[]).map((key) => ({
    key,
    label: record[key].label,
    description: record[key].description,
  }));

export function buildTaskCatalog() {
  return {
    task_types: toCatalogRows(TASK_TYPES),
    schedule_modes: toCatalogRows(SCHEDULE_MODES),
    trigger_sources: toCatalogRows(JOB_TRIGGER_SOURCES),
    job_statuses: toCatalogRows(JOB_STATUSES),
    request_target_kinds: toCatalogRows(REQUEST_TARGET_KINDS),
    request_retry_strategies: toCatalogRows(REQUEST_RETRY_STRATEGIES),
    rss_feed_modes: toCatalogRows(RSS_FEED_MODES),
    presets: {
      manual: MANUAL_PRESETS,
    },
  };
}
