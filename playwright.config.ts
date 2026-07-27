import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 120000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  use: {
    headless: true,
    baseURL: process.env.BASE_URL ?? 'http://localhost:8081',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  },
});
