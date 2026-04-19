import type { APIRoute } from 'astro';

import { getApiBaseUrl } from '@/application/auth/auth.server';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const response = await fetch(`${getApiBaseUrl()}/api/management/taxonomy/tags`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      cookie: request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({
      id: formData.get('id') || undefined,
      name: formData.get('name'),
      tag_type: formData.get('tag_type'),
      machine_key: formData.get('machine_key') || null,
      description: formData.get('description') || null,
      is_enabled: formData.get('is_enabled') === 'true',
    }),
  });

  if (response.status === 401) {
    return redirect('/login?next=%2Fmanagement%2Ftaxonomy', 302);
  }

  if (response.status === 403) {
    return redirect('/forbidden', 302);
  }

  if (!response.ok) {
    return new Response('Failed to save tag', { status: response.status });
  }

  return redirect('/management/taxonomy', 302);
};
