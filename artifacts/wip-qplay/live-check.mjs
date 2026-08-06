// Lead's live playcheck against the production URL (network use: intended target).
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto('https://rrocap.github.io/valhalla/', { waitUntil: 'domcontentloaded' });
await page.screenshot({ path: 'artifacts/screens/live-threshold.png' });
await page.getByRole('button', { name: /Lay hands/i }).click();
await page.waitForSelector('.medallion-hit', { timeout: 10000 });
await page.screenshot({ path: 'artifacts/screens/live-lid.png' });
await page.getByRole('button', { name: /Lock 1:/ }).click();
await page.waitForSelector('.lock-root', { timeout: 10000 });
await page.screenshot({ path: 'artifacts/screens/live-lock1.png' });
console.log('live check: threshold -> lid -> lock 1 OK; console errors:', errors.length, errors.slice(0, 3));
await browser.close();
process.exit(errors.length ? 1 : 0);
