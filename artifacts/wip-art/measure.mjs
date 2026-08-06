// artifacts/wip-art/measure.mjs — precise headless timing for chestScene,
// per the OW-ART <=8ms/after-cache-warm perf gate. Uses the already-installed
// @playwright/test package's exported `chromium` (no npm install).
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'http://127.0.0.1:8791/artifacts/wip-art/preview.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });

await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__timing, { timeout: 20000 });
const timing = await page.evaluate(() => window.__timing);

console.log(JSON.stringify(timing, null, 2));
if (pageErrors.length) {
  console.error('--- page/console errors ---');
  for (const e of pageErrors) console.error(e);
}
await browser.close();
process.exit(0);
