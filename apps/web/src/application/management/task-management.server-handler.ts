import { proxyUpstreamBody } from '@/application/shared/upstream-proxy.server';

export async function handleTaskManagementStreamRequest(request?: Request): Promise<Response> {
  void request;

  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: 'TASK_STREAM_REMOVED',
        message: 'Task realtime stream has been removed from the refactored task system.',
      },
    }),
    {
      status: 410,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    },
  );
}

export async function handleTaskJobExportRequest(
  jobId: string,
  request?: Request,
): Promise<Response> {
  if (!jobId.trim()) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: 'INVALID_JOB_ID',
          message: 'jobId is required.',
        },
      }),
      {
        status: 400,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      },
    );
  }

  return proxyUpstreamBody(
    `/api/management/tasks/jobs/${jobId}/export.xls`,
    { method: 'GET' },
    {
      request,
      fallbackMessage: '任务导出失败。',
      fallbackCode: 'TASK_EXPORT_FAILED',
      fallbackContentType: 'application/json; charset=utf-8',
    },
  );
}
