import { defineConfig, devices } from '@playwright/test';

import { getWebBaseUrl, getWebPort } from './tests/setup/env';

const browserProjects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
];

const selectedProjects =
  process.env.PLAYWRIGHT_ALL_BROWSERS === 'true'
    ? browserProjects
    : browserProjects.filter((project) => project.name === 'chromium');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.pw.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: getWebBaseUrl(),
    trace: 'on-first-retry',
  },

  projects: selectedProjects,

  webServer: {
    command: `pnpm -F @zhblogs/web run dev --host 127.0.0.1 --port ${getWebPort()}`,
    url: getWebBaseUrl(),
    reuseExistingServer: !process.env.CI,
  },
});
