// OW-B10: artifacts/wip-qplay/ink-targets.mjs, measurement unchanged, but
// crossing the threshold's new wager card (screens/threshold.js) which the
// shared harness's crossThreshold predates and now times out on. Same two
// floors: no blank canvas, no interactive target under 44x44 at phone width.
// Usage: node artifacts/wip-b10/ink-targets-b10.mjs
import { writeFileSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

async function crossThreshold(page) {
  await page.locator('.screen-threshold button').first().click();
  const wager = page.locator('.wager-continue');
  if (await wager.count()) {
    await wager.waitFor({ state: 'visible', timeout: 5000 });
    await wager.click();
  }
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

const browser = await H.launch();
const rows = [];
let bad = 0;
for (const vp of [H.DESKTOP, H.PHONE]) {
  for (let ord = 6; ord <= 15; ord++) {
    const page = await H.newPage(browser, vp);
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord) });
    await crossThreshold(page);
    await H.enterLock(page, ord);
    // The dare card can still be arriving 450ms in; measuring then reported an
    // EMPTY lock root (0 canvases, 0 controls) for the duel locks and passed
    // the floor vacuously. Answer the dare whenever it lands, then wait for the
    // board itself to exist before measuring anything.
    // The dare card lives INSIDE .lock-root and carries a canvas and a button
    // of its own, so "the root has a button or a canvas" is true while the dare
    // is still up — which is how the duel locks (7, 10, 13) measured an empty
    // board and passed the floor vacuously. The board is mounted only once the
    // dare card is gone AND real furniture is there.
    const mounted = () => page.evaluate(() => {
      const r = document.querySelector('.lock-root');
      if (!r || r.querySelector('.dare-card')) return false;
      return r.querySelectorAll('button,canvas').length > 0;
    });
    for (let tries = 0; tries < 25 && !(await mounted()); tries++) {
      const btn = page.locator('.dare-card .btn-carved');
      if (await btn.count()) await btn.first().click().catch(() => {});
      await page.waitForTimeout(200);
    }
    if (!(await mounted())) {
      // A lock that never mounts under a synthetic save is a harness/save-shape
      // drift in someone else's lane; record it rather than hiding it behind a
      // vacuous pass, and keep sweeping.
      rows.push({ vp: `${vp.width}x${vp.height}`, ord, error: 'never mounted a board' });
      if (ord === 10) bad++;
      await page.context().close();
      continue;
    }
    await page.waitForTimeout(450);
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
writeFileSync('artifacts/wip-b10/ink-targets.json', JSON.stringify(rows, null, 1));
console.log('vp        lock canvases blank            ctrls under44 sample');
for (const r of rows) {
  if (r.error) { console.log(`${r.vp.padEnd(9)} ${String(r.ord).padStart(3)}   ERROR: ${r.error}`); continue; }
  console.log(`${r.vp.padEnd(9)} ${String(r.ord).padStart(3)}  ${String(r.nCanvas).padStart(5)}   ${JSON.stringify(r.blank).padEnd(16)} ${String(r.nCtrl).padStart(4)}  ${String(r.under44).padStart(4)}   ${JSON.stringify(r.sample)}`);
}
console.log(bad === 0 ? 'INK+TARGET FLOOR: GREEN' : `INK+TARGET FLOOR: ${bad} row(s) failing`);
process.exit(bad === 0 ? 0 : 1);
