<script lang="ts">
  import {
    cancelTaskJobAction,
    deleteTaskJobAction,
    deleteTaskRequestConfigAction,
    fetchTaskOverviewAction,
    fetchTaskRequestConfigsAction,
    requeueTaskJobAction,
    runManualRSSFetchAction,
    runManualSiteCheckAction,
    runTaskScheduleAction,
    saveTaskRequestConfigAction,
    saveTaskScheduleAction,
    toggleTaskRequestConfigAction,
    toggleTaskScheduleAction,
  } from '@/application/management/task-management.browser';

  import {
    applyPresetToScheduleForm,
    buildSchedulePayload,
    buildTaskReturnTo,
    createEmptyScheduleForm,
    defaultTaskFilters,
    readJobRecord,
    readRequestConfigRecord,
    readScheduleRecord,
  } from './task-management.helpers';
  import {
    buildManualRSSFetchPayload,
    buildManualSiteCheckPayload,
    type ManualTaskKey,
    pickDefaultRequestConfigId,
  } from './task-management.panel.helpers';
  import type {
    JobFilterState,
    RequestConfigFormState,
    ScheduleFormState,
    SectionKey,
    TaskCatalog,
    TaskJobRecord,
    TaskRequestConfigRecord,
    TaskScheduleRecord,
  } from './task-management.types';
  import { normalizeSection } from './task-management.types';
  import {
    buildRequestConfigForm,
    buildRequestConfigPayload,
    createEmptyRequestConfigForm,
  } from './task-request-config.helpers';
  import TaskManagementView from './TaskManagementView.svelte';

  type PendingJobAction = { mode: 'cancel' | 'delete'; job: TaskJobRecord } | null;
  type Props = {
    catalog: TaskCatalog;
    schedules?: Array<Record<string, unknown>>;
    requestConfigs?: Array<Record<string, unknown>>;
    jobs?: Array<Record<string, unknown>>;
    initialPanel?: string;
    initialFilters?: Partial<JobFilterState>;
  };

  let {
    catalog,
    schedules: initialSchedules = [],
    requestConfigs: initialRequestConfigs = [],
    jobs: initialJobs = [],
    initialPanel = 'schedules',
    initialFilters = {},
  }: Props = $props();

  let initialized = false;
  let schedules = $state<TaskScheduleRecord[]>([]);
  let requestConfigs = $state<TaskRequestConfigRecord[]>([]);
  let jobs = $state<TaskJobRecord[]>([]);
  let filters = $state<JobFilterState>(defaultTaskFilters());
  let form = $state<ScheduleFormState>(createEmptyScheduleForm());
  let requestConfigForm = $state<RequestConfigFormState>(createEmptyRequestConfigForm());
  let manualSiteId = $state('');
  let manualRequestConfigId = $state('');
  let manualRunContentValidation = $state(false);
  let manualRunGlobalCheck = $state(false);
  let manualFeedMode = $state('DEFAULT_ONLY');
  let manualRSSFeedURL = $state('');
  let activeSection = $state<SectionKey>('schedules');
  let scheduleDialogOpen = $state(false);
  let requestConfigDialogOpen = $state(false);
  let manualDialogOpen = $state(false);
  let manualKind = $state<ManualTaskKey>('SITE_CHECK');
  let pendingJobAction = $state<PendingJobAction>(null);
  let busy = $state(false);
  let error = $state('');

  let sectionItems = $derived([
    {
      key: 'schedules',
      label: '调度定义',
      description: '定时建单模板、启停和立即执行。',
      count: schedules.length,
    },
    {
      key: 'requestConfigs',
      label: '请求配置',
      description: '维护 UA、超时、重试和默认请求头。',
      count: requestConfigs.length,
    },
    {
      key: 'manual',
      label: '手动执行',
      description: '手动创建单次任务，适合审核和回放。',
      count: 2,
    },
    {
      key: 'jobs',
      label: '作业记录',
      description: '筛选 job 并进入运行摘要详情。',
      count: jobs.length,
    },
  ]);
  let jobsReturnTo = $derived(buildTaskReturnTo('jobs', filters));

  $effect(() => {
    if (initialized) {
      return;
    }

    schedules = initialSchedules
      .map(readScheduleRecord)
      .filter((item): item is TaskScheduleRecord => item !== null);
    requestConfigs = initialRequestConfigs
      .map(readRequestConfigRecord)
      .filter((item): item is TaskRequestConfigRecord => item !== null);
    jobs = initialJobs.map(readJobRecord).filter((item): item is TaskJobRecord => item !== null);
    filters = { ...defaultTaskFilters(), ...initialFilters };
    activeSection = normalizeSection(initialPanel) ?? 'schedules';
    initialized = true;
  });

  function syncBrowserUrl(section: SectionKey, nextFilters: JobFilterState) {
    if (typeof window === 'undefined') return;
    window.history.replaceState(window.history.state, '', buildTaskReturnTo(section, nextFilters));
  }

  function openCreateSchedule() {
    form = createEmptyScheduleForm();
    scheduleDialogOpen = true;
  }
  function openEditSchedule(schedule: TaskScheduleRecord) {
    const next = applyPresetToScheduleForm(schedule, createEmptyScheduleForm());
    form = {
      ...next,
      id: schedule.id,
      isEnabled: schedule.is_enabled,
      requestConfigId: schedule.request_config_id ?? next.requestConfigId,
    };
    scheduleDialogOpen = true;
  }
  function openCreateRequestConfig() {
    requestConfigForm = createEmptyRequestConfigForm();
    requestConfigDialogOpen = true;
  }
  function openEditRequestConfig(record: TaskRequestConfigRecord) {
    requestConfigForm = buildRequestConfigForm(record);
    requestConfigDialogOpen = true;
  }
  function openManualDialog(kind: ManualTaskKey) {
    manualKind = kind;
    manualSiteId = '';
    manualRequestConfigId = pickDefaultRequestConfigId(kind, requestConfigs);
    manualRunContentValidation = false;
    manualRunGlobalCheck = false;
    manualFeedMode = 'DEFAULT_ONLY';
    manualRSSFeedURL = '';
    manualDialogOpen = true;
  }
  function handleSectionSelect(key: string) {
    const next = normalizeSection(key);
    if (!next) return;
    activeSection = next;
    syncBrowserUrl(next, filters);
  }

  const closeScheduleDialog = () => !busy && (scheduleDialogOpen = false);
  const closeRequestConfigDialog = () => !busy && (requestConfigDialogOpen = false);
  const closeManualDialog = () => !busy && (manualDialogOpen = false);
  const clearPendingJobAction = () => !busy && (pendingJobAction = null);
  const requestCancelJob = (job: TaskJobRecord) => (pendingJobAction = { mode: 'cancel', job });
  const requestDeleteJob = (job: TaskJobRecord) => (pendingJobAction = { mode: 'delete', job });

  async function loadOverview(nextFilters: JobFilterState) {
    const result = await fetchTaskOverviewAction(nextFilters);
    if (!result.ok || !result.data) return void (error = result.message);
    filters = { ...nextFilters };
    schedules = result.data.schedules
      .map(readScheduleRecord)
      .filter((item): item is TaskScheduleRecord => item !== null);
    jobs = result.data.jobs
      .map(readJobRecord)
      .filter((item): item is TaskJobRecord => item !== null);
    syncBrowserUrl(activeSection, nextFilters);
  }

  async function refreshRequestConfigs() {
    const result = await fetchTaskRequestConfigsAction();
    if (!result.ok || !result.data) return void (error = result.message);
    requestConfigs = result.data
      .map(readRequestConfigRecord)
      .filter((item): item is TaskRequestConfigRecord => item !== null);
  }

  async function runBusyTask(task: () => Promise<void>) {
    busy = true;
    error = '';
    try {
      await task();
    } finally {
      busy = false;
    }
  }

  const refreshOverview = async () => loadOverview(filters);
  const resetFilters = async () => loadOverview(defaultTaskFilters());

  async function submitSchedule() {
    await runBusyTask(async () => {
      const result = await saveTaskScheduleAction(buildSchedulePayload(form));
      if (!result.ok) return void (error = result.message);
      scheduleDialogOpen = false;
      form = createEmptyScheduleForm();
      await refreshOverview();
    });
  }

  async function submitRequestConfig() {
    await runBusyTask(async () => {
      const result = await saveTaskRequestConfigAction(
        buildRequestConfigPayload(requestConfigForm),
      );
      if (!result.ok) return void (error = result.message);
      requestConfigDialogOpen = false;
      requestConfigForm = createEmptyRequestConfigForm();
      await refreshRequestConfigs();
    });
  }

  async function submitManualTask() {
    await runBusyTask(async () => {
      const result =
        manualKind === 'SITE_CHECK'
          ? await runManualSiteCheckAction(
              buildManualSiteCheckPayload(
                manualSiteId,
                manualRequestConfigId,
                manualRunContentValidation,
                manualRunGlobalCheck,
              ),
            )
          : await runManualRSSFetchAction(
              buildManualRSSFetchPayload(
                manualSiteId,
                manualRequestConfigId,
                manualFeedMode,
                manualRSSFeedURL,
              ),
            );
      if (!result.ok) return void (error = result.message);
      manualDialogOpen = false;
      activeSection = 'jobs';
      await refreshOverview();
    });
  }

  async function toggleSchedule(scheduleId: string) {
    await runBusyTask(async () => {
      const result = await toggleTaskScheduleAction(scheduleId);
      if (!result.ok) return void (error = result.message);
      await refreshOverview();
    });
  }

  async function runSchedule(scheduleId: string) {
    await runBusyTask(async () => {
      const result = await runTaskScheduleAction(scheduleId);
      if (!result.ok) return void (error = result.message);
      activeSection = 'jobs';
      await refreshOverview();
    });
  }

  async function toggleRequestConfig(configId: string) {
    await runBusyTask(async () => {
      const result = await toggleTaskRequestConfigAction(configId);
      if (!result.ok) return void (error = result.message);
      await refreshRequestConfigs();
    });
  }

  async function deleteRequestConfig(configId: string) {
    await runBusyTask(async () => {
      const result = await deleteTaskRequestConfigAction(configId);
      if (!result.ok) return void (error = result.message);
      await refreshRequestConfigs();
    });
  }

  async function retryJob(jobId: string) {
    await runBusyTask(async () => {
      const result = await requeueTaskJobAction(jobId);
      if (!result.ok) return void (error = result.message);
      activeSection = 'jobs';
      await refreshOverview();
    });
  }

  async function confirmJobAction() {
    const currentAction = pendingJobAction;
    if (!currentAction) return;
    await runBusyTask(async () => {
      const result =
        currentAction.mode === 'cancel'
          ? await cancelTaskJobAction(currentAction.job.id)
          : await deleteTaskJobAction(currentAction.job.id);
      if (!result.ok) return void (error = result.message);
      pendingJobAction = null;
      await refreshOverview();
    });
  }
</script>

<TaskManagementView
  {catalog}
  {schedules}
  {requestConfigs}
  {jobs}
  bind:filters
  bind:form
  bind:requestConfigForm
  bind:manualSiteId
  bind:manualRequestConfigId
  bind:manualRunContentValidation
  bind:manualRunGlobalCheck
  bind:manualFeedMode
  bind:manualRSSFeedURL
  {activeSection}
  {sectionItems}
  {jobsReturnTo}
  {scheduleDialogOpen}
  {requestConfigDialogOpen}
  {manualDialogOpen}
  {manualKind}
  {pendingJobAction}
  {busy}
  {error}
  onSelectSection={handleSectionSelect}
  onCreateSchedule={openCreateSchedule}
  onEditSchedule={openEditSchedule}
  onRunSchedule={runSchedule}
  onToggleSchedule={toggleSchedule}
  onCreateRequestConfig={openCreateRequestConfig}
  onEditRequestConfig={openEditRequestConfig}
  onToggleRequestConfig={toggleRequestConfig}
  onDeleteRequestConfig={deleteRequestConfig}
  onOpenManual={openManualDialog}
  onCancelJob={requestCancelJob}
  onDeleteJob={requestDeleteJob}
  onRetryJob={retryJob}
  onRefreshJobs={refreshOverview}
  onResetFilters={resetFilters}
  onCancelSchedule={closeScheduleDialog}
  onConfirmSchedule={submitSchedule}
  onCancelRequestConfig={closeRequestConfigDialog}
  onConfirmRequestConfig={submitRequestConfig}
  onCancelManual={closeManualDialog}
  onConfirmManual={submitManualTask}
  onCancelJobAction={clearPendingJobAction}
  onConfirmJobAction={confirmJobAction}
/>
