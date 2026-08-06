// Probe: render open/next/sealed medallions big on the real build's art module
// and save a crop, plus sample the pixel at the rune stroke centre.
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 660, height: 240 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:8791/index.html#autotest');
await page.waitForFunction(() => !!window.__OW);
const sample = await page.evaluate(() => {
  // reach the art module through a fresh canvas — the shell exposes no art
  // handle, so re-import from the bundle is impossible; instead paint via the
  // lid's own painter by mounting a big offscreen chestScene? Simpler: the
  // bundle is an IIFE. Fall back: sample the LIVE lid canvas at a known open
  // medallion socket instead.
  return null;
});
await page.close();

// Live-lid route: seed 5 opened, read socket 2's centre pixel colours.
const page2 = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page2.addInitScript(() => {
  localStorage.setItem('oathwood.v1', JSON.stringify({
    opened: ['01-runerow', '02-bismer', '03-beacons', '04-strakes', '05-knotwork'],
    attempts: {}, hints: {}, journal: [],
    settings: { muted: true, reducedMotion: null }, startedAt: '2026-01-01T00:00:00.000Z',
  }));
});
await page2.goto('http://127.0.0.1:8791/index.html#autotest');
await page2.waitForFunction(() => !!window.__OW);
await page2.getByRole('button', { name: /Lay hands on the chest|Continue/ }).first().click();
await page2.waitForSelector('.screen-lid');
await page2.waitForTimeout(600);
const res = await page2.evaluate(() => {
  const btn = document.querySelector('.medallion-hit[aria-label^="Lock 2:"]');
  const r = btn.getBoundingClientRect();
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const canvas = document.querySelector('.lid-canvas');
  const ctx = canvas.getContext('2d');
  const d = canvas.width / canvas.clientWidth;
  // sample a horizontal scanline through the medallion centre
  const line = [];
  for (let ox = -30; ox <= 30; ox += 3) {
    const px = ctx.getImageData(Math.round((cx + ox) * d), Math.round(cy * d), 1, 1).data;
    line.push(`${ox}:[${px[0]},${px[1]},${px[2]}]`);
  }
  return { cx, cy, line };
});
console.log(res.line.join('\n'));
const btn = page2.locator('.medallion-hit[aria-label^="Lock 2:"]');
const bb = await btn.boundingBox();
await page2.screenshot({
  path: new URL('./probe-open-medallion.png', import.meta.url).pathname,
  clip: { x: bb.x - 20, y: bb.y - 20, width: bb.width + 40, height: bb.height + 40 },
});
await browser.close();
