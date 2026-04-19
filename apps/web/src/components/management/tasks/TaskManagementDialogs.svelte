<script lang="ts">
  import ConfirmDialog from '@/shared/ui/ConfirmDialog.svelte';

  import type {
    RequestConfigFormState,
    ScheduleFormState,
    TaskCatalog,
    TaskJobRecord,
    TaskRequestConfigRecord,
  } from './task-management.types';
  import TaskManualTriggerDialog from './TaskManualTriggerDialog.svelte';
  import TaskRequestConfigDialog from './TaskRequestConfigDialog.svelte';
  import TaskScheduleDialog from './TaskScheduleDialog.svelte';

  type ManualTaskKey = 'SITE_CHECK' | 'RSS_FETCH';
  type PendingJobAction =
    | { mode: 'cancel'; job: TaskJobRecord }
    | { mode: 'delete'; job: TaskJobRecord }
    | null;

  let {
    catalog,
    requestConfigs,
    form = $bindable(),
    requestConfigForm = $bindable(),
    scheduleDialogOpen = false,
    requestConfigDialogOpen = false,
    manualDialogOpen = false,
    manualKind = 'SITE_CHECK',
    manualSiteId = $bindable(''),
    manualRequestConfigId = $bindable(''),
    manualRunContentValidation = $bindable(false),
    manualRunGlobalCheck = $bindable(false),
    manualFeedMode = $bindable('DEFAULT_ONLY'),
    manualRSSFeedURL = $bindable(''),
    pendingJobAction = null,
    busy = false,
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
    requestConfigs: TaskRequestConfigRecord[];
    form: ScheduleFormState;
    requestConfigForm: RequestConfigFormState;
    scheduleDialogOpen?: boolean;
    requestConfigDialogOpen?: boolean;
    manualDialogOpen?: boolean;
    manualKind?: ManualTaskKey;
    manualSiteId?: string;
    manualRequestConfigId?: string;
    manualRunContentValidation?: boolean;
    manualRunGlobalCheck?: boolean;
    manualFeedMode?: string;
    manualRSSFeedURL?: string;
    pendingJobAction?: PendingJobAction;
    busy?: boolean;
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

<TaskScheduleDialog
  open={scheduleDialogOpen}
  {catalog}
  {requestConfigs}
  bind:form
  {busy}
  onCancel={onCancelSchedule}
  onConfirm={onConfirmSchedule}
/>

<TaskRequestConfigDialog
  open={requestConfigDialogOpen}
  {catalog}
  bind:form={requestConfigForm}
  {busy}
  onCancel={onCancelRequestConfig}
  onConfirm={onConfirmRequestConfig}
/>

<TaskManualTriggerDialog
  open={manualDialogOpen}
  kind={manualKind}
  {requestConfigs}
  bind:siteId={manualSiteId}
  bind:requestConfigId={manualRequestConfigId}
  bind:runContentValidation={manualRunContentValidation}
  bind:runGlobalCheck={manualRunGlobalCheck}
  bind:feedMode={manualFeedMode}
  bind:feedUrl={manualRSSFeedURL}
  {busy}
  onCancel={onCancelManual}
  onConfirm={onConfirmManual}
/>

<ConfirmDialog
  open={pendingJobAction !== null}
  title={pendingJobAction?.mode === 'cancel'
    ? pendingJobAction.job.status === 'RUNNING'
      ? '确认发起取消请求'
      : '确认取消任务'
    : '确认删除任务'}
  description={pendingJobAction
    ? pendingJobAction.mode === 'cancel' && pendingJobAction.job.status === 'RUNNING'
      ? `${pendingJobAction.job.task_type} · ${pendingJobAction.job.id} · 发起后由 worker 协商停止。`
      : `${pendingJobAction.job.task_type} · ${pendingJobAction.job.id}`
    : ''}
  confirmLabel={busy
    ? '处理中…'
    : pendingJobAction?.mode === 'cancel'
      ? pendingJobAction.job.status === 'RUNNING'
        ? '确认发起'
        : '确认取消'
      : '确认删除'}
  cancelLabel="返回"
  dismissible={!busy}
  onCancel={onCancelJobAction}
  onConfirm={onConfirmJobAction}
/>
