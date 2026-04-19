import type { APIRoute } from 'astro';

import { getApiBaseUrl } from '@/application/auth/auth.server';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const jobId = formData.get('job_id');

  if (typeof jobId !== 'string') {
    return new Response('Invalid job delete request', { status: 400 });
  }

  const response = await fetch(`${getApiBaseUrl()}/api/management/tasks/jobs/${jobId}`, {
    method: 'DELETE',
    headers: {
      accept: 'application/json',
      cookie: request.headers.get('cookie') ?? '',
    },
  });

  if (response.status === 401) {
    return redirect('/login?next=%2Fmanagement%2Ftasks', 302);
  }

  if (response.status === 403) {
    return redirect('/forbidden', 302);
  }

  if (!response.ok) {
    return new Response('Failed to delete job', { status: response.status });
  }

  return redirect('/management/tasks', 302);
};
