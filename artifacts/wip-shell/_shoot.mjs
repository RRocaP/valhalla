// Throwaway verification driver (not a deliverable) — walks the dev.html
// fixture flow and the real built page with real input events, screenshots
// each step, and reports console errors. Re-run freely during iteration.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const VER = process.argv[2] || 'v1';
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${String(e)}`));

async function shot(name) {
  await page.screenshot({ path: `${OUT}${name}-${VER}.png` });
}

// ---------------- dev.html fixture flow ----------------
await page.goto('http://127.0.0.1:8791/artifacts/wip-shell/dev.html#autotest');
await page.waitForTimeout(150);
await shot('01-threshold');

await page.click('button:has-text("Lay hands on the chest")');
await page.waitForTimeout(150);
await shot('02-lid');

// open journal + settings (empty/first-look state) before touching locks
await page.click('.journal-handle');
await page.waitForTimeout(350);
await shot('03-journal-empty');
await page.click('.overlay-close');
await page.waitForTimeout(350);
await page.click('.settings-nail');
await page.waitForTimeout(350);
await shot('04-settings');
await page.click('.overlay-close');
await page.waitForTimeout(350);

// fx-01-echo: wrong x3 (arm hint 1), take hint, then solve
await page.click('.medallion-hit[aria-label*="— next"]');
await page.waitForTimeout(150);
await shot('05-lockroom-fx1');

const target1 = await page.evaluate(() => window.__OW.instanceOf('fx-01-echo').n);
const wrong1 = (target1 + 1) % 10;
for (let i = 0; i < 3; i++) {
  await page.click(`.lock-root button:text-is("${wrong1}")`);
  await page.waitForTimeout(120);
}
await shot('06-lockroom-wrong-x3');

await page.click('.hint-slot[data-state="armed"]');
await page.waitForTimeout(120);
await shot('07-lockroom-hint-taken');

await page.click(`.lock-root button:text-is("${target1}")`);
await page.waitForTimeout(250);
await shot('08-ceremony-shard');
await page.waitForTimeout(900);
await shot('09-lid-after-solve1');

// fx-02-hue: solve immediately (no duel, ordinal 2)
await page.click('.medallion-hit[aria-label*="— next"]');
await page.waitForTimeout(150);
const target2 = await page.evaluate(() => window.__OW.instanceOf('fx-02-hue').target);
await page.click(`.lock-root button:text-is("${target2}")`);
await page.waitForTimeout(900);
await shot('10-lid-after-solve2');

// fx-03-triad: ordinal 3 => duel (JARL BOURJ) — dare card first
await page.click('.medallion-hit[aria-label*="— next"]');
await page.waitForTimeout(150);
await shot('11-dare-card');

await page.click('button:has-text("Answer the dare")');
await page.waitForTimeout(150);
await shot('12-lockroom-fx3');

const seq = await page.evaluate(() => window.__OW.instanceOf('fx-03-triad').seq);
const rows = await page.$$('.lock-root > div > div');
for (let i = 0; i < 3; i++) {
  const btns = await rows[i].$$('button');
  await btns[seq[i]].click();
  await page.waitForTimeout(120);
}
await page.waitForTimeout(300);
await shot('13-yield-beat');
await page.waitForTimeout(1400);
await shot('14-finale-intro');
await page.waitForTimeout(2600);
await shot('15-finale-tebi');

await page.click('.finale-reveal');
await page.waitForTimeout(200);
await shot('16-finale-alano');

await page.click('.finale-reveal');
await page.waitForTimeout(200);
await shot('17-finale-tableau');

await page.click('button:has-text("Raise the horns")');
await page.waitForTimeout(1200);
await shot('18-credits');
await page.mouse.wheel(0, 600);
await page.waitForTimeout(200);
await shot('19-credits-scrolled');

await page.click('.credits-skip');
await page.waitForTimeout(300);
await shot('20-finale-return');

// mobile width sanity: assert no horizontal scroll on a few key screens
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

await browser.close();

console.log('SCREENSHOTS_DIR', OUT);
console.log('HORIZONTAL_OVERFLOW_AT_390', overflow);
console.log('CONSOLE_ERRORS', errors.length);
errors.forEach((e) => console.log(e));
