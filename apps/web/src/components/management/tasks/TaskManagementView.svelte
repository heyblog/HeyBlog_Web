<script lang="ts">
  import FormMessage from '@/shared/ui/FormMessage.svelte';

  import type { ManualTaskKey } from './task-management.panel.helpers';
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
  import TaskCenterSummaryStrip from './TaskCenterSummaryStrip.svelte';
  import TaskJobsSection from './TaskJobsSection.svelte';
  import TaskManagementDialogs from './TaskManagementDialogs.svelte';
  import TaskManualSection from './TaskManualSection.svelte';
  import TaskRequestConfigsSection from './TaskRequestConfigsSection.svelte';
  import TaskSchedulesSection from './TaskSchedulesSection.svelte';
  import TaskSectionTabs from './TaskSectionTabs.svelte';

  type PendingJobAction = { mode: 'cancel' | 'delete'; job: TaskJobRecord } | null;

  let {
    catalog,
    schedules,
    requestConfigs,
    jobs,
    filters = $bindable(),
    form = $bindable(),
    requestConfigForm = $bindable(),
    manualSiteId = $bindable(''),
    manualRequestConfigId = $bindable(''),
    manualRunContentValidation = $bindable(false),
    manualRunGlobalCheck = $bindable(false),
    manualFeedMode = $bindable('DEFAULT_ONLY'),
    manualRSSFeedURL = $bindable(''),
    activeSection,
    sectionItems,
    jobsReturnTo,
    scheduleDialogOpen = false,
    requestConfigDialogOpen = false,
    manualDialogOpen = false,
    manualKind = 'SITE_CHECK',
    pendingJobAction = null,
    busy = false,
    error = '',
    onSelectSection,
    onCreateSchedule,
    onEditSchedule,
    onRunSchedule,
    onToggleSchedule,
    onCreateRequestConfig,
    onEditRequestConfig,
    onToggleRequestConfig,
    onDeleteRequestConfig,
    onOpenManual,
    onCancelJob,
    onDeleteJob,
    onRetryJob,
    onRefreshJobs,
    onResetFilters,
    onCancelSchedule,
    onConfirmSchedule,
    onCancelRequestConfig,
    onConfirmRequestConfig,
    onCancelManual,
    onConfirmManual,
    onCancelJobAction,
    onConfirmJobAction,
  }: {
    catalog: TaskCatalog;
    schedules: TaskScheduleRecord[];
    requestConfigs: TaskRequestConfigRecord[];
    jobs: TaskJobRecord[];
    filters: JobFilterState;
    form: ScheduleFormState;
    requestConfigForm: RequestConfigFormState;
    manualSiteId?: string;
    manualRequestConfigId?: string;
    manualRunContentValidation?: boolean;
    manualRunGlobalCheck?: boolean;
    manualFeedMode?: string;
    manualRSSFeedURL?: string;
    activeSection: SectionKey;
    sectionItems: Array<{ key: string; label: string; description: string; count: number }>;
    jobsReturnTo: string;
    scheduleDialogOpen?: boolean;
    requestConfigDialogOpen?: boolean;
    manualDialogOpen?: boolean;
    manualKind?: ManualTaskKey;
    pendingJobAction?: PendingJobAction;
    busy?: boolean;
    error?: string;
    onSelectSection?: (key: string) => void;
    onCreateSchedule?: () => void;
    onEditSchedule?: (schedule: TaskScheduleRecord) => void;
    onRunSchedule?: (scheduleId: string) => void;
    onToggleSchedule?: (scheduleId: string) => void;
    onCreateRequestConfig?: () => void;
    onEditRequestConfig?: (record: TaskRequestConfigRecord) => void;
    onToggleRequestConfig?: (configId: string) => void;
    onDeleteRequestConfig?: (configId: string) => void;
    onOpenManual?: (kind: ManualTaskKey) => void;
    onCancelJob?: (job: TaskJobRecord) => void;
    onDeleteJob?: (job: TaskJobRecord) => void;
    onRetryJob?: (jobId: string) => void;
    onRefreshJobs?: () => void;
    onResetFilters?: () => void;
    onCancelSchedule?: () => void;
    onConfirmSchedule?: () => void;
    onCancelRequestConfig?: () => void;
    onConfirmRequestConfig?: () => void;
    onCancelManual?: () => void;
    onConfirmManual?: () => void;
    onCancelJobAction?: () => void;
    onConfirmJobAction?: () => void;
  } = $props();
</script>

<div class="space-y-4">
  <TaskCenterSummaryStrip {schedules} {jobs} requestConfigCount={requestConfigs.length} />

  {#if error}
    <FormMessage tone="error" eyebrow="TASK CENTER" title="操作失败" message={error} />
  {/if}

  <TaskSectionTabs items={sectionItems} activeKey={activeSection} onSelect={onSelectSection} />

  <div
    id={`task-panel-${activeSection}`}
    role="tabpanel"
    aria-labelledby={`task-tab-${activeSection}`}
  >
    {#if activeSection === 'schedules'}
      <TaskSchedulesSection
        {requestConfigs}
        {schedules}
        {busy}
        onCreate={onCreateSchedule}
        onEdit={onEditSchedule}
        onRun={onRunSchedule}
        onToggle={onToggleSchedule}
      />
    {:else if activeSection === 'requestConfigs'}
      <TaskRequestConfigsSection
        {requestConfigs}
        {busy}
        onCreate={onCreateRequestConfig}
        onEdit={onEditRequestConfig}
        onToggle={onToggleRequestConfig}
        onDelete={onDeleteRequestConfig}
      />
    {:else if activeSection === 'manual'}
      <TaskManualSection {catalog} onOpen={onOpenManual} />
    {:else}
      <TaskJobsSection
        {catalog}
        {jobs}
        bind:filters
        returnTo={jobsReturnTo}
        onCancel={onCancelJob}
        onDelete={onDeleteJob}
        onRetry={onRetryJob}
        onRefresh={onRefreshJobs}
        {onResetFilters}
      />
    {/if}
  </div>

  <TaskManagementDialogs
    {catalog}
    {requestConfigs}
    bind:form
    bind:requestConfigForm
    {scheduleDialogOpen}
    {requestConfigDialogOpen}
    {manualDialogOpen}
    {manualKind}
    bind:manualSiteId
    bind:manualRequestConfigId
    bind:manualRunContentValidation
    bind:manualRunGlobalCheck
    bind:manualFeedMode
    bind:manualRSSFeedURL
    {pendingJobAction}
    {busy}
    {onCancelSchedule}
    {onConfirmSchedule}
    {onCancelRequestConfig}
    {onConfirmRequestConfig}
    {onCancelManual}
    {onConfirmManual}
    {onCancelJobAction}
    {onConfirmJobAction}
  />
</div>
