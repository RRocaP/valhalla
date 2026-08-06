// OW-B08 lane config: same runtime contract as playwright.config.mjs, pointed
// at this lane's single-lock spec (the shared testDir is tests/e2e).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:8791', viewport: { width: 1280, height: 800 } },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'iphone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: {
    command: 'node ../../scripts/serve.mjs',
    url: 'http://127.0.0.1:8791',
    reuseExistingServer: true,
  },
});
