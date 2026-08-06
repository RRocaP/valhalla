// OW-QUALITY-VIS capture config. Separate from the QA-owned playwright.config.mjs
// (tests/** is not my lane): retina deviceScaleFactor 2, the two docs/QUALITY.md
// viewports, screenshots only — no assertions that could mask a QA gate.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /capture\.spec\.mjs/,
  timeout: 180_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8791',
    deviceScaleFactor: 2,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'iphone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  ],
  webServer: {
    command: 'node scripts/serve.mjs',
    url: 'http://127.0.0.1:8791',
    reuseExistingServer: true,
    cwd: '../..',
  },
});
