// Throwaway verification driver for the REAL built page (not a deliverable).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const VER = process.argv[2] || 'v1';
const errors = [];
const failedRequests = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${String(e)}`));
page.on('requestfailed', (r) => failedRequests.push(r.url()));
page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });

async function shot(name) { await page.screenshot({ path: `${OUT}real-${name}-${VER}.png` }); }

await page.goto('http://127.0.0.1:8791/#autotest');
await page.waitForTimeout(200);
await shot('01-threshold');

const lockCount = await page.evaluate(() => window.__OW.locks.length);
const firstLockTitle = await page.evaluate(() => window.__OW.locks[0].title);

await page.click('button:has-text("Lay hands on the chest")');
await page.waitForTimeout(400);
await shot('02-lid');

await page.click('.medallion-hit[aria-label*="— next"]');
await page.waitForTimeout(250);
await shot('03-lockroom-first-real-lock');

// desktop pass on the lid too, for a wider comparison (fresh save so
// threshold still shows "Lay hands on the chest")
await page.evaluate(() => localStorage.clear());
await page.setViewportSize({ width: 1280, height: 900 });
// Chromium can bfcache-restore instead of re-executing scripts when the
// target URL (incl. hash) is identical to the current one — force a real
// reload rather than relying on goto() to notice anything changed.
await page.reload();
await page.waitForTimeout(200);
await page.click('button:has-text("Lay hands on the chest")');
await page.waitForTimeout(400);
await shot('04-lid-desktop');

await browser.close();
console.log('LOCK_COUNT', lockCount, 'FIRST_TITLE', firstLockTitle);
console.log('CONSOLE_ERRORS', errors.length);
errors.forEach((e) => console.log(e));
console.log('FAILED_OR_4XX_5XX_REQUESTS', failedRequests.length);
failedRequests.forEach((f) => console.log(f));
