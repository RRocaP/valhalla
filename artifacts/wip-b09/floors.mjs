// OW-B09 deterministic floors for board 09, both viewports:
//   1. every canvas has ink; 2. every interactive target >= 44px;
//   3. field occupancy of the lock root >= 55%; 4. contrast samples for the
//   board's own text over its real backgrounds (>= 4.5 body, >= 3 display).
import * as H from '../wip-qplay/harness.mjs';

async function crossThreshold(page) {
  await page.locator('.screen-threshold .btn-carved').first().click();
  const wager = page.getByRole('button', { name: 'Take the wager', exact: true });
  try { await wager.waitFor({ state: 'visible', timeout: 2500 }); await wager.click(); } catch { /* none */ }
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

const browser = await H.launch();
let bad = 0;
for (const vp of [H.DESKTOP, H.PHONE]) {
  const name = vp.width < 500 ? 'phone' : 'desktop';
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(9) });
  await crossThreshold(page);
  await H.enterLock(page, 9);
  await H.answerDare(page);
  await page.waitForTimeout(3600); // let the showing end
  const m = await page.evaluate(() => {
    const root = document.querySelector('.lock-root');
    const rootRect = root.getBoundingClientRect();
    // 1. ink
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
    // 2. targets
    const els = [...root.querySelectorAll('button,[role="option"],[role="slider"],[role="button"],a[href],input')];
    const small = els.map((e) => {
      const r = e.getBoundingClientRect();
      return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 18) };
    }).filter((o) => o.w > 0 && (o.w < 44 || o.h < 44));
    // 3. occupancy: union of the board's furniture boxes over the root area
    const parts = ['.plate', '.station', '.dial', '.side', '.law'].map((s) => root.querySelector(s)).filter(Boolean);
    let covered = 0;
    for (const el of parts) {
      const r = el.getBoundingClientRect();
      const w = Math.max(0, Math.min(r.right, rootRect.right) - Math.max(r.left, rootRect.left));
      const h = Math.max(0, Math.min(r.bottom, rootRect.bottom) - Math.max(r.top, rootRect.top));
      covered += w * h; // parts don't overlap (flex/grid siblings)
    }
    const occupancy = covered / (rootRect.width * rootRect.height);
    // 4. contrast samples (element colour vs sampled backdrop, like tests/e2e/helpers.mjs)
    function lum({ r, g, b }) {
      const ch = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    }
    function parseRgb(str) {
      const m = str.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map((s) => parseFloat(s.trim()));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    function backdropOf(el) {
      let node = el;
      while (node && node !== document.documentElement) {
        const c = parseRgb(getComputedStyle(node).backgroundColor);
        if (c && c.a > 0.5) return c;
        node = node.parentElement;
      }
      return { r: 40, g: 26, b: 13 }; // the room's wood field, conservative mid
    }
    const samples = {};
    for (const [key, sel] of [['plate', '.plate'], ['bearing', '.bearing'], ['watch', '.watch'], ['name', '.stone .name'], ['law', '.law'], ['cand', '.cand'], ['wet', '.wet']]) {
      const el = root.querySelector(sel);
      if (!el) continue;
      const fg = parseRgb(getComputedStyle(el).color);
      const bg = backdropOf(el);
      const L1 = Math.max(lum(fg), lum(bg));
      const L2 = Math.min(lum(fg), lum(bg));
      samples[key] = +(((L1 + 0.05) / (L2 + 0.05))).toFixed(2);
    }
    return { nCanvas: canvases.length, blank, nCtrl: els.length, small, occupancy: +occupancy.toFixed(3), samples };
  });
  const fail = m.blank.length || m.small.length || m.occupancy < 0.55
    || Object.entries(m.samples).some(([k, v]) => v < (k === 'bearing' || k === 'watch' ? 3 : 4.5));
  if (fail) bad++;
  console.log(name, JSON.stringify(m, null, 1));
  await page.context().close();
}
await browser.close();
console.log(bad === 0 ? 'B09 FLOORS: GREEN' : `B09 FLOORS: ${bad} viewport(s) failing`);
process.exit(bad === 0 ? 0 : 1);
