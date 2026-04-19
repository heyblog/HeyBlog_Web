import type {
  JobFilterState,
  ScheduleFormState,
  SectionKey,
  TaskJobRecord,
  TaskRequestConfigRecord,
  TaskScheduleRecord,
} from './task-management.types';
import {
  FALLBACK_TIMEZONE,
  readIntegerString,
  readObject,
  readString,
} from './task-management.types';

export {
  readJobDetailRecord,
  readJobRecord,
  readRequestConfigRecord,
  readRSSFetchRunRecord,
  readScheduleRecord,
  readSiteCheckRunRecord,
  readUpstreamSyncRunRecord,
  sanitizeTaskReturnTo,
} from './task-management.records';

const trimValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const defaultTaskFilters = (): JobFilterState => ({
  status: '',
  task_type: '',
  trigger_source: '',
  site_id: '',
  created_from: '',
  created_to: '',
});

export const createEmptyScheduleForm = (): ScheduleFormState => ({
  id: null,
  name: '',
  taskType: 'SITE_CHECK',
  scheduleMode: 'INTERVAL',
  requestConfigId: '',
  isEnabled: true,
  timezone: FALLBACK_TIMEZONE,
  cron: '',
  intervalSeconds: '',
  jitterSeconds: '',
  targetKind: 'ALL_VISIBLE',
  targetSiteId: '',
  targetSiteIds: '',
  sourceId: '',
  feedMode: 'DEFAULT_ONLY',
  runContentValidation: false,
  runGlobalCheck: false,
  runFullCheck: false,
});

export const applyPresetToScheduleForm = (
  preset: Record<string, unknown>,
  base: ScheduleFormState,
): ScheduleFormState => {
  const payloadTemplate = readObject(preset.payload_template);
  const target = readObject(payloadTemplate.target);
  const options = readObject(payloadTemplate.options);
  const scheduleConfig = readObject(preset.schedule_config);

  return {
    ...base,
    name: readString(preset.name) || base.name,
    taskType: readString(preset.task_type) || base.taskType,
    scheduleMode: readString(preset.schedule_mode) || base.scheduleMode,
    requestConfigId: readString(preset.request_config_id) || base.requestConfigId,
    cron: readString(scheduleConfig.cron),
    intervalSeconds: readIntegerString(scheduleConfig.interval_seconds),
    jitterSeconds: readIntegerString(scheduleConfig.jitter_seconds),
    timezone: readString(scheduleConfig.timezone) || base.timezone,
    targetKind: readString(target.kind) || base.targetKind,
    targetSiteId: readString(target.site_id),
    targetSiteIds: Array.isArray(target.site_ids)
      ? target.site_ids.filter((item): item is string => typeof item === 'string').join(', ')
      : '',
    sourceId: readString(payloadTemplate.source_id),
    feedMode: readString(options.feed_mode) || base.feedMode,
    runContentValidation: options.run_content_validation === true,
    runGlobalCheck: options.run_global_check === true,
    runFullCheck: options.run_full_check === true,
  };
};

const parseSiteIDs = (value: string): string[] =>
  value
    .split(/[\s,]+/u)
    .map((item) => item.trim())
    .filter(Boolean);

const buildScheduleTarget = (form: ScheduleFormState): Record<string, unknown> => {
  if (form.taskType === 'UPSTREAM_SYNC') {
    return form.sourceId.trim() ? { source_id: form.sourceId.trim() } : {};
  }

  const target: Record<string, unknown> = { kind: form.targetKind };
  if (form.targetKind === 'SITE' && form.targetSiteId.trim()) {
    target.site_id = form.targetSiteId.trim();
  }
  if (form.targetKind === 'SITE_LIST') {
    const siteIDs = parseSiteIDs(form.targetSiteIds);
    if (siteIDs.length > 0) {
      target.site_ids = siteIDs;
    }
  }

  return {
    target,
    options: {
      ...(form.taskType === 'SITE_CHECK'
        ? {
            run_content_validation: form.runContentValidation,
            run_global_check: form.runGlobalCheck,
            ...(form.targetKind === 'ALL_VISIBLE' && form.runFullCheck
              ? { run_full_check: true }
              : {}),
          }
        : {}),
      ...(form.taskType === 'RSS_FETCH' ? { feed_mode: form.feedMode || 'DEFAULT_ONLY' } : {}),
      source: 'schedule',
    },
  };
};

const buildScheduleConfig = (form: ScheduleFormState): Record<string, unknown> => {
  if (form.scheduleMode === 'CRON') {
    return {
      ...(form.cron.trim() ? { cron: form.cron.trim() } : {}),
      timezone: form.timezone.trim() || FALLBACK_TIMEZONE,
    };
  }

  return {
    ...(form.intervalSeconds.trim()
      ? { interval_seconds: Number.parseInt(form.intervalSeconds.trim(), 10) }
      : {}),
    ...(form.jitterSeconds.trim()
      ? { jitter_seconds: Number.parseInt(form.jitterSeconds.trim(), 10) }
      : {}),
    timezone: form.timezone.trim() || FALLBACK_TIMEZONE,
  };
};

export const buildSchedulePayload = (form: ScheduleFormState): Record<string, unknown> => ({
  ...(form.id ? { id: form.id } : {}),
  name: form.name.trim(),
  task_type: form.taskType,
  schedule_mode: form.scheduleMode,
  ...(form.requestConfigId.trim() ? { request_config_id: form.requestConfigId.trim() } : {}),
  is_enabled: form.isEnabled,
  schedule_config: buildScheduleConfig(form),
  payload_template: buildScheduleTarget(form),
});

export const buildTaskTargetSummary = (payload: Record<string, unknown>): string => {
  const sourceId = trimValue(payload.source_id);
  if (sourceId) {
    return `上游源 ${sourceId}`;
  }

  const target = readObject(payload.target);
  const kind = trimValue(target.kind);
  if (kind === 'SITE') {
    return trimValue(target.site_id) ? `单站点 ${trimValue(target.site_id)}` : '单站点';
  }
  if (kind === 'SITE_LIST') {
    const siteIds = Array.isArray(target.site_ids)
      ? target.site_ids.filter((item) => typeof item === 'string')
      : [];
    return siteIds.length > 0 ? `站点列表 ${siteIds.length} 个` : '站点列表';
  }
  if (kind === 'ALL_VISIBLE') {
    return '全部公开站点';
  }

  return '未设置目标';
};

export const buildScheduleWindow = (config: Record<string, unknown>): string => {
  const cron = trimValue(config.cron);
  const intervalSeconds =
    typeof config.interval_seconds === 'number' ? config.interval_seconds : Number.NaN;
  const timezone = trimValue(config.timezone);

  if (cron) {
    return `CRON ${cron}${timezone ? ` · ${timezone}` : ''}`;
  }
  if (Number.isFinite(intervalSeconds) && intervalSeconds > 0) {
    return `间隔 ${intervalSeconds}s${timezone ? ` · ${timezone}` : ''}`;
  }

  return timezone ? `时区 ${timezone}` : '未设置周期';
};

export const buildRequestConfigLabel = (
  requestConfigId: string | null,
  requestConfigs: TaskRequestConfigRecord[],
): string => {
  if (!requestConfigId) {
    return '未选择请求配置';
  }

  const matched = requestConfigs.find((item) => item.id === requestConfigId);
  return matched ? matched.name : requestConfigId;
};

export const buildScheduleMetaSummary = (
  schedule: TaskScheduleRecord,
  requestConfigs: TaskRequestConfigRecord[],
): string => {
  const items = [
    buildTaskTargetSummary(schedule.payload_template),
    buildScheduleWindow(schedule.schedule_config),
    buildRequestConfigLabel(schedule.request_config_id, requestConfigs),
  ].filter(Boolean);

  return items.join(' · ') || '未设置调度信息';
};

export const buildScheduleOptionSummary = (schedule: TaskScheduleRecord): string => {
  const options = readObject(schedule.payload_template.options);
  const items = [
    options.run_content_validation === true ? '包含内容校验' : '',
    options.run_global_check === true ? '包含全局检测' : '',
    options.run_full_check === true ? '全量检测' : '',
    trimValue(options.feed_mode) ? `Feed 模式 ${trimValue(options.feed_mode)}` : '',
  ].filter(Boolean);

  return items.join(' · ');
};

export const buildJobResultSummary = (job: TaskJobRecord): string => {
  const result = readObject(job.result ?? {});
  const keys = ['total_count', 'processed_count', 'success_count', 'failure_count', 'source_count'];
  const parts = keys
    .map((key) => {
      const value = result[key];
      if (typeof value !== 'number') {
        return '';
      }

      const labelMap: Record<string, string> = {
        total_count: '总数',
        processed_count: '已处理',
        success_count: '成功',
        failure_count: '失败',
        source_count: '源数',
      };
      return `${labelMap[key]} ${value}`;
    })
    .filter(Boolean);

  return parts.join(' · ');
};

export const buildTaskReturnTo = (section: SectionKey, filters: JobFilterState): string => {
  const params = new URLSearchParams();
  params.set('panel', section);

  for (const [key, value] of Object.entries(filters)) {
    const normalized = trimValue(value);
    if (normalized) {
      params.set(key, normalized);
    }
  }

  const query = params.toString();
  return query ? `/management/tasks?${query}` : '/management/tasks';
};
