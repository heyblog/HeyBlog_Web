import type { APIRoute } from 'astro';

import { getApiBaseUrl } from '@/application/auth/auth.server';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const scheduleId = formData.get('schedule_id');

  if (typeof scheduleId !== 'string') {
    return new Response('Invalid task run request', { status: 400 });
  }

  const response = await fetch(
    `${getApiBaseUrl()}/api/management/tasks/schedules/${scheduleId}/run`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        cookie: request.headers.get('cookie') ?? '',
      },
    },
  );

  if (response.status === 401) {
    return redirect('/login?next=%2Fmanagement%2Ftasks', 302);
  }

  if (response.status === 403) {
    return redirect('/forbidden', 302);
  }

  if (!response.ok) {
    return new Response('Failed to enqueue schedule', { status: response.status });
  }

  return redirect('/management/tasks', 302);
};
