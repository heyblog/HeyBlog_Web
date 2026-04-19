import type { Page } from '@playwright/test';

type JsonRoutePayload = {
  status?: number;
  body: unknown;
};

export const mockJsonRoute = async (
  page: Page,
  pattern: string | RegExp,
  payload: JsonRoutePayload,
): Promise<void> => {
  await page.route(pattern, async (route) => {
    await route.fulfill({
      status: payload.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(payload.body),
    });
  });
};
