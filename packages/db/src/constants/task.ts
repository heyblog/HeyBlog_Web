export const TASK_TYPES = {
  UPSTREAM_SYNC: {
    label: '上游同步',
    description: '从上游博客源同步站点基础信息并生成变更结果',
  },
  SITE_CHECK: {
    label: '站点检测',
    description: '检测站点可用性、响应时间与信息一致性',
  },
  RSS_FETCH: {
    label: 'RSS 抓取',
    description: '抓取站点 RSS/ATOM/JSON Feed 文章并入库',
  },
} as const;

export const TASK_TYPE_KEYS = Object.keys(TASK_TYPES) as Array<keyof typeof TASK_TYPES>;

export type TaskTypeKey = (typeof TASK_TYPE_KEYS)[number];

export const SCHEDULE_MODES = {
  CRON: {
    label: 'Cron 定时',
    description: '按 Cron 表达式定时创建任务',
  },
  INTERVAL: {
    label: '固定间隔',
    description: '按固定时间间隔持续创建任务',
  },
} as const;

export const SCHEDULE_MODE_KEYS = Object.keys(SCHEDULE_MODES) as Array<keyof typeof SCHEDULE_MODES>;

export type ScheduleModeKey = (typeof SCHEDULE_MODE_KEYS)[number];

export const JOB_TRIGGER_SOURCES = {
  SCHEDULE: {
    label: '调度触发',
    description: '由任务调度器自动生成的任务',
  },
  MANUAL: {
    label: '手动触发',
    description: '由后台或接口人工触发的任务',
  },
  EVENT: {
    label: '事件触发',
    description: '由业务事件直接触发的任务',
  },
} as const;

export const JOB_TRIGGER_SOURCE_KEYS = Object.keys(JOB_TRIGGER_SOURCES) as Array<
  keyof typeof JOB_TRIGGER_SOURCES
>;

export type JobTriggerSourceKey = (typeof JOB_TRIGGER_SOURCE_KEYS)[number];

export const JOB_STATUSES = {
  PENDING: {
    label: '待执行',
    description: '任务已入队，等待消费者处理',
  },
  RUNNING: {
    label: '执行中',
    description: '任务已被 Worker 锁定并正在执行',
  },
  SUCCEEDED: {
    label: '已成功',
    description: '任务执行完成且结果成功',
  },
  FAILED: {
    label: '已失败',
    description: '任务执行失败，等待重试或人工处理',
  },
  CANCELED: {
    label: '已取消',
    description: '任务被人工或系统取消执行',
  },
} as const;

export const JOB_STATUS_KEYS = Object.keys(JOB_STATUSES) as Array<keyof typeof JOB_STATUSES>;

export type JobStatusKey = (typeof JOB_STATUS_KEYS)[number];

export const REQUEST_TARGET_KINDS = {
  SITE: {
    label: '单站点',
    description: '仅处理一个指定站点',
  },
  SITE_LIST: {
    label: '站点列表',
    description: '处理多个指定站点',
  },
  ALL_VISIBLE: {
    label: '全部可见站点',
    description: '处理当前全部前台可见站点',
  },
} as const;

export const REQUEST_TARGET_KIND_KEYS = Object.keys(REQUEST_TARGET_KINDS) as Array<
  keyof typeof REQUEST_TARGET_KINDS
>;

export type RequestTargetKindKey = (typeof REQUEST_TARGET_KIND_KEYS)[number];

export const RSS_FEED_MODES = {
  DEFAULT_ONLY: {
    label: '默认订阅源',
    description: '仅抓取默认订阅源',
  },
  ALL: {
    label: '全部订阅源',
    description: '抓取站点配置中的全部订阅源',
  },
} as const;

export const RSS_FEED_MODE_KEYS = Object.keys(RSS_FEED_MODES) as Array<keyof typeof RSS_FEED_MODES>;

export type RSSFeedModeKey = (typeof RSS_FEED_MODE_KEYS)[number];

export const REQUEST_RETRY_STRATEGIES = {
  FIXED: {
    label: '固定退避',
    description: '每次重试使用固定等待时间',
  },
  LINEAR: {
    label: '线性退避',
    description: '按线性倍率增加等待时间',
  },
  EXPONENTIAL: {
    label: '指数退避',
    description: '按指数倍率增加等待时间',
  },
} as const;

export const REQUEST_RETRY_STRATEGY_KEYS = Object.keys(REQUEST_RETRY_STRATEGIES) as Array<
  keyof typeof REQUEST_RETRY_STRATEGIES
>;

export type RequestRetryStrategyKey = (typeof REQUEST_RETRY_STRATEGY_KEYS)[number];

export const SITE_CHECK_MODES = {
  STANDARD: {
    label: '标准检测',
    description: '按历史访问范围策略执行本次站点检测',
  },
  GLOBAL_FORCED: {
    label: '全局检测',
    description: '强制使用双地域执行本次站点检测',
  },
} as const;

export const SITE_CHECK_MODE_KEYS = Object.keys(SITE_CHECK_MODES) as Array<
  keyof typeof SITE_CHECK_MODES
>;

export type SiteCheckModeKey = (typeof SITE_CHECK_MODE_KEYS)[number];

export const CONTENT_VALIDATION_STATUSES = {
  NOT_REQUESTED: {
    label: '未请求',
    description: '本次检测未执行站点内容校验',
  },
  PASSED: {
    label: '通过',
    description: '本次检测执行了站点内容校验并通过',
  },
  FAILED: {
    label: '失败',
    description: '本次检测执行了站点内容校验但未通过',
  },
} as const;

export const CONTENT_VALIDATION_STATUS_KEYS = Object.keys(CONTENT_VALIDATION_STATUSES) as Array<
  keyof typeof CONTENT_VALIDATION_STATUSES
>;

export type ContentValidationStatusKey = (typeof CONTENT_VALIDATION_STATUS_KEYS)[number];

export const RSS_FETCH_NETWORK_PATHS = {
  CN_ONLY: {
    label: '仅 CN',
    description: '本次 RSS 抓取只使用国内网络路径',
  },
  NON_CN_ONLY: {
    label: '仅 GLOBAL',
    description: '本次 RSS 抓取只使用非中国大陆网络路径',
  },
  CN_THEN_NON_CN: {
    label: 'CN 后回退 GLOBAL',
    description: '优先使用国内网络路径，失败后回退到非中国大陆路径',
  },
} as const;

export const RSS_FETCH_NETWORK_PATH_KEYS = Object.keys(RSS_FETCH_NETWORK_PATHS) as Array<
  keyof typeof RSS_FETCH_NETWORK_PATHS
>;

export type RSSFetchNetworkPathKey = (typeof RSS_FETCH_NETWORK_PATH_KEYS)[number];

export const RUN_RECORD_STATUSES = {
  SUCCEEDED: {
    label: '成功',
    description: '本次站点级执行成功完成',
  },
  FAILED: {
    label: '失败',
    description: '本次站点级执行失败',
  },
  SKIPPED: {
    label: '跳过',
    description: '本次站点级执行被跳过',
  },
} as const;

export const RUN_RECORD_STATUS_KEYS = Object.keys(RUN_RECORD_STATUSES) as Array<
  keyof typeof RUN_RECORD_STATUSES
>;

export type RunRecordStatusKey = (typeof RUN_RECORD_STATUS_KEYS)[number];

export const SITE_VERIFY_RESULTS = {
  NOT_REQUESTED: {
    label: '未请求',
    description: '本次检测未执行信息复核',
  },
  PASSED: {
    label: '通过',
    description: '本次检测通过信息复核',
  },
  FAILED: {
    label: '失败',
    description: '本次检测未通过信息复核',
  },
} as const;

export const SITE_VERIFY_RESULT_KEYS = Object.keys(SITE_VERIFY_RESULTS) as Array<
  keyof typeof SITE_VERIFY_RESULTS
>;

export type SiteVerifyResultKey = (typeof SITE_VERIFY_RESULT_KEYS)[number];

export const RSS_FEED_FORMATS = {
  RSS: {
    label: 'RSS',
    description: 'RSS XML 订阅源',
  },
  ATOM: {
    label: 'Atom',
    description: 'Atom XML 订阅源',
  },
  JSON: {
    label: 'JSON Feed',
    description: 'JSON Feed 订阅源',
  },
  UNKNOWN: {
    label: '未知',
    description: '未识别或未返回有效格式',
  },
} as const;

export const RSS_FEED_FORMAT_KEYS = Object.keys(RSS_FEED_FORMATS) as Array<
  keyof typeof RSS_FEED_FORMATS
>;

export type RSSFeedFormatKey = (typeof RSS_FEED_FORMAT_KEYS)[number];

export const RSS_FETCH_SOURCE_KINDS = {
  LOCAL: {
    label: '本地抓取',
    description: '由 Worker 本地直接抓取',
  },
  CLOUDFLARE: {
    label: 'Cloudflare',
    description: '由 Cloudflare Worker 抓取',
  },
  CLOUDFLARE_FALLBACK: {
    label: 'Cloudflare 回退',
    description: '本地失败后回退到 Cloudflare 抓取',
  },
} as const;

export const RSS_FETCH_SOURCE_KIND_KEYS = Object.keys(RSS_FETCH_SOURCE_KINDS) as Array<
  keyof typeof RSS_FETCH_SOURCE_KINDS
>;

export type RSSFetchSourceKindKey = (typeof RSS_FETCH_SOURCE_KIND_KEYS)[number];
