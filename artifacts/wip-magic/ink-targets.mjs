// Two deterministic floors, re-runnable:
//  1. every canvas the lock draws actually has ink (a blank canvas is a silent
//     art failure — lock 06 shipped one until this pass)
//  2. every interactive target is >= 44 x 44 CSS px at phone width
import { writeFileSync } from 'node:fs';
import * as H from './harness.mjs';

const browser = await H.launch();
const rows = [];
let bad = 0;
for (const vp of [H.DESKTOP, H.PHONE]) {
  for (let ord = 1; ord <= 15; ord++) {
    const page = await H.newPage(browser, vp);
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord) });
    await H.crossThreshold(page);
    await H.enterLock(page, ord);
    await H.answerDare(page);
    // B10/B13 finding: a fixed settle sampled empty .lock-root on dare locks —
    // the floor passed by measuring nothing. Wait for real board content.
    await page.waitForSelector('.lock-root canvas, .lock-root button', { timeout: 10000 });
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
writeFileSync('artifacts/wip-magic/ink-targets.json', JSON.stringify(rows, null, 1));
console.log('vp        lock canvases blank            ctrls under44 sample');
for (const r of rows) {
  console.log(`${r.vp.padEnd(9)} ${String(r.ord).padStart(3)}  ${String(r.nCanvas).padStart(5)}   ${JSON.stringify(r.blank).padEnd(16)} ${String(r.nCtrl).padStart(4)}  ${String(r.under44).padStart(4)}   ${JSON.stringify(r.sample)}`);
}
console.log(bad === 0 ? 'INK+TARGET FLOOR: GREEN' : `INK+TARGET FLOOR: ${bad} row(s) failing`);
process.exit(bad === 0 ? 0 : 1);
