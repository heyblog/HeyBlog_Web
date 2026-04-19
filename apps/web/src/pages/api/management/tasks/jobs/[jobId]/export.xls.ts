import type { APIRoute } from 'astro';

import { handleTaskJobExportRequest } from '@/application/management/task-management.server-handler';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) =>
  handleTaskJobExportRequest(params.jobId?.trim() ?? '', request);
