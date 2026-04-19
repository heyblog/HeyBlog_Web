import type { APIRoute } from 'astro';

import { handleTaskManagementStreamRequest } from '@/application/management/task-management.server-handler';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => handleTaskManagementStreamRequest(request);
