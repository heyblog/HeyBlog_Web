import type { APIRoute } from 'astro';

import { getApiBaseUrl } from '@/application/auth/auth.server';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const sourceTagId = formData.get('source_tag_id');
  const targetTagId = formData.get('target_tag_id');

  if (typeof sourceTagId !== 'string' || typeof targetTagId !== 'string') {
    return new Response('Invalid tag merge request', { status: 400 });
  }

  const response = await fetch(
    `${getApiBaseUrl()}/api/management/taxonomy/tags/${sourceTagId}/merge`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        cookie: request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({
        target_tag_id: targetTagId,
      }),
    },
  );

  if (response.status === 401) {
    return redirect('/login?next=%2Fmanagement%2Ftaxonomy', 302);
  }

  if (response.status === 403) {
    return redirect('/forbidden', 302);
  }

  if (!response.ok) {
    return new Response('Failed to merge tags', { status: response.status });
  }

  return redirect('/management/taxonomy', 302);
};
