// Real-game captures: the lid with a breathing next-medallion, desktop +
// iphone at dSF2, fresh + mid-progress + reduced-motion. Expects
// scripts/serve.mjs on 127.0.0.1:8791 serving the BUILT root index.html.
import { chromium } from '@playwright/test';

const DIR = 'artifacts/wip-runefire';
const browser = await chromium.launch();
const errs = [];

async function toLid(page, { reload = false } = {}) {
  // goto to an identical URL+hash is a no-op — after seeding storage we must
  // hard-reload so the app re-reads the save instead of keeping fresh state.
  if (reload) await page.reload({ waitUntil: 'load' });
  else await page.goto('http://127.0.0.1:8791/#autotest', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__OW === 'object' && !!window.__OW, { timeout: 15000 });
  // fresh save: 'Lay hands on the chest' · existing save: 'Continue'
  const begin = page.getByRole('button', { name: /Lay hands on the chest|Continue/ }).first();
  await begin.click();
  const wager = page.getByRole('button', { name: 'Take the wager', exact: true });
  try { await wager.waitFor({ state: 'visible', timeout: 2500 }); await wager.click(); } catch {}
  await page.locator('.hasp-wrap').waitFor({ state: 'attached', timeout: 15000 });
}

async function shoot(name, viewport, opts = {}) {
  const ctx = await browser.newContext({
    viewport, deviceScaleFactor: 2,
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
    hasTouch: viewport.width < 800, isMobile: viewport.width < 800,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`${name}: ${m.text()}`); });
  page.on('pageerror', (e) => errs.push(`${name}: ${e}`));

  if (opts.opened) {
    // seed a mid-game save BEFORE the app reads storage
    await page.goto('http://127.0.0.1:8791/#autotest', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.__OW === 'object' && !!window.__OW, { timeout: 15000 });
    await page.evaluate((n) => {
      const ids = window.__OW.locks.slice(0, n).map((l) => l.id);
      localStorage.setItem('oathwood.v1', JSON.stringify({
        opened: ids, attempts: {}, hints: {}, journal: [],
        settings: { muted: true, reducedMotion: null },
        startedAt: new Date().toISOString(),
      }));
    }, opts.opened);
  }
  await toLid(page, { reload: !!opts.opened });
  // land mid-breath so the next-medallion's rune-fire (and wisps) are alive
  await page.waitForTimeout(opts.reduced ? 400 : 1150);
  await page.screenshot({ path: `${DIR}/${name}.png` });
  console.log(`wrote ${DIR}/${name}.png`);
  await ctx.close();
}

await shoot('game-lid-fresh-desktop', { width: 1280, height: 800 });
await shoot('game-lid-fresh-iphone', { width: 390, height: 844 });
await shoot('game-lid-progress4-desktop', { width: 1280, height: 800 }, { opened: 4 });
await shoot('game-lid-progress4-iphone', { width: 390, height: 844 }, { opened: 4 });
await shoot('game-lid-reduced-desktop', { width: 1280, height: 800 }, { reduced: true });

console.log(errs.length ? `CONSOLE ERRORS:\n${errs.join('\n')}` : 'console: clean');
await browser.close();
