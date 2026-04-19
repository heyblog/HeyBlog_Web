import type { APIRoute } from 'astro';

import { getApiBaseUrl } from '@/application/auth/auth.server';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const response = await fetch(`${getApiBaseUrl()}/api/management/taxonomy/technologies`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      cookie: request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({
      id: formData.get('id') || undefined,
      name: formData.get('name'),
      technology_type: formData.get('technology_type'),
      description: formData.get('description') || null,
      official_url: formData.get('official_url') || null,
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
    return new Response('Failed to save technology', { status: response.status });
  }

  return redirect('/management/taxonomy', 302);
};
