import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.addInitScript(() => localStorage.setItem('oathwood.v1', JSON.stringify({
  opened: ['01-runerow'], attempts: {}, hints: {}, journal: [],
  settings: { muted: true, reducedMotion: null }, startedAt: '2026-01-01T00:00:00.000Z' })));
await p.goto('http://127.0.0.1:8791/#autotest');
await p.getByRole('button', { name: /Lay hands|Continue/ }).first().click();
await p.locator('.medallion-hit[aria-label^="Lock 2:"]').click();
await p.waitForSelector('.screen-lockroom');
const ans = await p.evaluate(() => window.__OW.answerOf('02-bismer'));
await p.locator('[role="radio"].ow2-pouch').nth(ans.pouch).click();
await p.getByRole('button', { name: 'Name the pouch', exact: true }).click();
await p.waitForSelector('.ceremony-overlay');
const t0 = Date.now();
await p.locator('.ceremony-overlay').click();          // tap-to-skip
await p.waitForSelector('.screen-lid', { timeout: 4000 });
console.log('tap-to-skip returned to lid in', Date.now() - t0, 'ms (ceremony beat is 700ms + 150ms tail)');
console.log('page errors:', errs.length ? errs : 'none');
await b.close();
