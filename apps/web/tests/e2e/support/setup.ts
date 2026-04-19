import type { Page } from '@playwright/test';

import { mockJsonRoute } from './network';

export const installHomeApiMocks = async (page: Page): Promise<void> => {
  await mockJsonRoute(page, /\/api\/home$/, {
    body: {
      ok: true,
      data: {
        summary: {
          totalSites: 0,
          featuredSites: 0,
          todayUpdates: 0,
        },
      },
    },
  });

  await mockJsonRoute(page, /\/api\/announcements\/current$/, {
    body: {
      ok: true,
      data: null,
    },
  });
};
