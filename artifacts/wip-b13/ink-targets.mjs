// Same two floors as artifacts/wip-qplay/ink-targets.mjs — every canvas has
// ink, every interactive target clears 44x44 — re-run from this lane because
// the shared rig's crossThreshold() predates the threshold's wager step and
// now times out before it reaches a lock. Nothing else differs.
import { writeFileSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

async function cross(page) {
  await page.locator('.screen-threshold button').first().click();
  await page.waitForTimeout(400);
  const wager = page.locator('.wager-continue');
  if (await wager.count()) await wager.click();
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
}

const browser = await H.launch();
const rows = [];
let bad = 0;
for (const vp of [H.DESKTOP, H.PHONE]) {
  for (let ord = 6; ord <= 15; ord++) {
    const page = await H.newPage(browser, vp);
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord) });
    await cross(page);
    await H.enterLock(page, ord);
    await H.answerDare(page);
    // 450ms (the shared rig's wait) is short enough that locks 7, 10 and 13
    // were measured before their view mounted and reported 0 canvases / 0
    // controls — a floor that passes by measuring nothing. Wait for real ink.
    try {
      await page.waitForSelector('.lock-root button', { timeout: 12000 });
    } catch (e) {
      const seen = await page.evaluate(() => ({
        screens: [...document.querySelectorAll('.screen')].map((s) => s.className),
        overlays: [...document.querySelectorAll('[class*="card"],[class*="overlay"]')].map((s) => s.className).slice(0, 6),
        rootHtml: (document.querySelector('.lock-root') || {}).innerHTML ? 'has html' : 'empty',
      }));
      console.error(`lock ${ord} @ ${vp.width}: no controls —`, JSON.stringify(seen));
      throw e;
    }
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const root = document.querySelector('.lock-root');
      const canvases = [...root.querySelectorAll('canvas')];
      const blank = [];
      for (const c of canvases) {
        if (!c.width || !c.height) { blank.push('zero-sized'); continue; }
        let ink = 0;
        try {
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 8) { ink++; if (ink > 20) break; }
        } catch (e) { ink = -1; }
        if (ink >= 0 && ink <= 20) blank.push(`${c.width}x${c.height} ink=${ink}`);
      }
      const els = [...root.querySelectorAll('button,[role="option"],[role="slider"],[role="button"],a[href],input')];
      const small = els.map((e) => {
        const r = e.getBoundingClientRect();
        return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 16) };
      }).filter((o) => o.w > 0 && (o.w < 44 || o.h < 44));
      return { nCanvas: canvases.length, blank, nCtrl: els.length, under44: small.length, sample: small.slice(0, 4) };
    });
    rows.push({ vp: `${vp.width}x${vp.height}`, ord, ...m });
    if (m.blank.length || m.under44) bad++;
    await page.context().close();
  }
}
await browser.close();
writeFileSync('artifacts/wip-b13/ink-targets.json', JSON.stringify(rows, null, 1));
console.log('vp        lock canvases blank            ctrls under44 sample');
for (const r of rows) {
  console.log(`${r.vp.padEnd(9)} ${String(r.ord).padStart(3)}  ${String(r.nCanvas).padStart(5)}   ${JSON.stringify(r.blank).padEnd(16)} ${String(r.nCtrl).padStart(4)}  ${String(r.under44).padStart(4)}   ${JSON.stringify(r.sample)}`);
}
console.log(bad === 0 ? 'INK+TARGET FLOOR: GREEN' : `INK+TARGET FLOOR: ${bad} row(s) failing`);
process.exit(bad === 0 ? 0 : 1);
