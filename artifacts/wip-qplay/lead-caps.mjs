// Lead capture: current HEAD at retina — the screens Ramon judges.
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:8791/#autotest', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
await page.screenshot({ path: 'artifacts/wip-loop2/lead-threshold.png' });
await page.getByRole('button', { name: /Lay hands|Continue/i }).first().click();
await page.waitForSelector('.medallion-hit');
await page.waitForTimeout(900);
await page.screenshot({ path: 'artifacts/wip-loop2/lead-lid.png' });
await page.getByRole('button', { name: /Lock 1:/ }).click();
await page.waitForSelector('.lock-root');
await page.waitForTimeout(600);
await page.screenshot({ path: 'artifacts/wip-loop2/lead-lock01.png' });
await browser.close();
console.log('caps done');
