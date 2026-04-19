import { expect, test as base } from '@playwright/test';

type AppFixtures = {
  gotoPath: (path: string) => Promise<void>;
};

export const test = base.extend<AppFixtures>({
  gotoPath: async ({ page }, use) => {
    await use(async (path: string) => {
      await page.goto(path);
    });
  },
});

export { expect };
