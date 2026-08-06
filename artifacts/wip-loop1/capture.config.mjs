// OW-LOOP1 capture config — same shape as the ratified wip-qvis harness:
// retina dSF2, the two docs/QUALITY.md viewports, screenshots only.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /capture\.spec\.mjs/,
  timeout: 240_000,
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
