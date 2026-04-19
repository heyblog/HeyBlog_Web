import type { APIRoute } from 'astro';

import { getApiBaseUrl } from '@/application/auth/auth.server';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const response = await fetch(`${getApiBaseUrl()}/api/management/tasks/manual/rss-retry`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      cookie: request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({
      site_id: formData.get('site_id'),
      feed_url: formData.get('feed_url'),
    }),
  });

  if (response.status === 401) {
    return redirect('/login?next=%2Fmanagement%2Ftasks', 302);
  }

  if (response.status === 403) {
    return redirect('/forbidden', 302);
  }

  if (!response.ok) {
    return new Response('Failed to enqueue manual rss retry', { status: response.status });
  }

  return redirect('/management/tasks', 302);
};
