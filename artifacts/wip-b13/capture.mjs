// OW-B13 board capture: lock 13 (The Althing Verdict) at both viewports, dSF2,
// plus the density rubric numbers (field occupancy, largest featureless region,
// board->controls gap), the 44px target floor, canvas ink, and the contrast of
// every text style on the board over its real painted background.
// Usage: node artifacts/wip-b13/capture.mjs <tag> [--branded]
import { writeFileSync, mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'now';
const branded = process.argv.includes('--branded');
mkdirSync('artifacts/wip-b13/shots', { recursive: true });

// The threshold gained a wager step after wip-qplay/harness.mjs was written;
// crossThreshold() there still clicks once. Local crossing, shared harness
// left alone (it belongs to another lane).
async function cross(page) {
  await page.locator('.screen-threshold button').first().click();
  await page.waitForTimeout(500);
  const wager = page.locator('.wager-continue');
  if (await wager.count()) await wager.click();
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
}

const browser = await H.launch();
const out = [];
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(13) });
  await cross(page);
  await H.enterLock(page, 13);
  await H.answerDare(page);
  await page.waitForTimeout(4000); // let the showing run out

  if (branded) {
    // real input: brand a spread of stones and hang the collar, so the capture
    // shows sears, the collar, greyed settled words and the reach on the ground
    const brands = page.locator('.ow13-brand');
    for (const [i, times] of [[0, 1], [1, 2], [2, 1], [3, 2], [4, 1]]) {
      for (let k = 0; k < times; k++) await brands.nth(i).click();
    }
    await page.locator('.ow13-culprit').nth(2).click();
    await page.waitForTimeout(320);
  }

  await page.screenshot({ path: `artifacts/wip-b13/shots/${tag}-${name}.png`, fullPage: true });
  await page.screenshot({ path: `artifacts/wip-b13/shots/${tag}-${name}-fold.png` });

  const m = await page.evaluate(() => {
    const root = document.querySelector('.lock-root');
    const r = root.getBoundingClientRect();
    const els = [...root.querySelectorAll('button,[role="radio"],[role="slider"],[role="button"],a[href],input')];
    const under44 = els.map((e) => {
      const b = e.getBoundingClientRect();
      return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 22) };
    }).filter((o) => o.w > 0 && (o.w < 44 || o.h < 44));

    const canvases = [...root.querySelectorAll('canvas')].map((c) => {
      let ink = 0;
      try {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) ink++;
      } catch (e) { ink = -1; }
      const b = c.getBoundingClientRect();
      return { w: c.width, h: c.height, cssW: +b.width.toFixed(0), cssH: +b.height.toFixed(0), ink, cover: +(ink / (c.width * c.height)).toFixed(3) };
    });

    // ---- density rubric, measured over the lock-root box on a coarse grid ----
    const CELL = 8;
    const cols = Math.ceil(r.width / CELL);
    const rows = Math.ceil(r.height / CELL);
    const grid = new Uint8Array(cols * rows);
    const mark = (box) => {
      const x0 = Math.max(0, Math.floor((box.left - r.left) / CELL));
      const x1 = Math.min(cols - 1, Math.ceil((box.right - r.left) / CELL) - 1);
      const y0 = Math.max(0, Math.floor((box.top - r.top) / CELL));
      const y1 = Math.min(rows - 1, Math.ceil((box.bottom - r.top) / CELL) - 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * cols + x] = 1;
    };
    const walk = (el) => {
      for (const ch of el.children) {
        if (ch.tagName === 'STYLE' || ch.tagName === 'SCRIPT') continue;
        const b = ch.getBoundingClientRect();
        const leaf = !ch.children.length || ch.tagName === 'CANVAS' || ch.tagName === 'BUTTON';
        if (b.width > 0 && b.height > 0 && leaf) mark(b);
        if (!leaf) walk(ch);
      }
    };
    walk(root);
    let filled = 0;
    for (let i = 0; i < grid.length; i++) filled += grid[i];
    const occupancy = +(filled / grid.length).toFixed(3);

    // largest empty axis-aligned rectangle (histogram sweep over 0-cells)
    let best = 0;
    const heights = new Int32Array(cols);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) heights[x] = grid[y * cols + x] ? 0 : heights[x] + 1;
      const st = [];
      for (let x = 0; x <= cols; x++) {
        const h = x === cols ? 0 : heights[x];
        let start = x;
        while (st.length && st[st.length - 1][1] >= h) {
          const [s, hh] = st.pop();
          best = Math.max(best, hh * (x - s));
          start = s;
        }
        st.push([start, h]);
      }
    }
    const largestVoid = +(best / grid.length).toFixed(3);

    // vertical gap between the last board furniture above it and the primary action
    const act = root.querySelector('.btn-carved, button.ow13-act');
    let gap = null;
    if (act) {
      const ab = act.getBoundingClientRect();
      let bottom = r.top;
      for (const c of root.querySelectorAll('canvas')) {
        const b = c.getBoundingClientRect();
        if (b.bottom < ab.top + 1 && b.bottom > bottom) bottom = b.bottom;
      }
      gap = +(ab.top - bottom).toFixed(0);
    }

    // ---- contrast of each board text style over the canvas painted behind it
    const lum = (rgb) => {
      const f = rgb.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
    };
    const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const behind = (el) => {
      // average the pixels of the nearest painted canvas under the text box
      const b = el.getBoundingClientRect();
      const list = [...root.querySelectorAll('canvas')];
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i];
        const cb = c.getBoundingClientRect();
        if (b.left < cb.left || b.right > cb.right || b.top < cb.top || b.bottom > cb.bottom) continue;
        try {
          const sx = Math.round((b.left - cb.left) / cb.width * c.width);
          const sy = Math.round((b.top - cb.top) / cb.height * c.height);
          const sw = Math.max(1, Math.round(b.width / cb.width * c.width));
          const sh = Math.max(1, Math.round(b.height / cb.height * c.height));
          const d = c.getContext('2d').getImageData(sx, sy, sw, sh).data;
          let rr = 0; let gg = 0; let bb = 0; let n = 0;
          for (let k = 0; k < d.length; k += 4) { rr += d[k]; gg += d[k + 1]; bb += d[k + 2]; n++; }
          return [rr / n, gg / n, bb / n];
        } catch (e) { /* tainted or out of range */ }
      }
      return null;
    };
    const ratio = (sel) => {
      const el = root.querySelector(sel);
      if (!el) return null;
      const fg = parse(getComputedStyle(el).color);
      const bg = behind(el);
      if (!bg) return null;
      const a = lum(fg);
      const b2 = lum(bg);
      return +(((Math.max(a, b2) + 0.05) / (Math.min(a, b2) + 0.05))).toFixed(2);
    };
    const contrast = {
      plate: ratio('.ow13-platetext'),
      name: ratio('.ow13-name'),
      sayLive: ratio('.ow13-say[data-state="live"]'),
      sayHeld: ratio('.ow13-say[data-state="held"]'),
      sayBroken: ratio('.ow13-say[data-state="broken"]'),
    };

    const sayStates = {};
    for (const el of root.querySelectorAll('.ow13-say')) {
      const s = el.dataset.state || '?';
      sayStates[s] = (sayStates[s] || 0) + 1;
    }

    return {
      box: { w: +r.width.toFixed(0), h: +r.height.toFixed(0) },
      scrollH: root.scrollHeight,
      occupancy, largestVoid, gap,
      nCanvas: canvases.length,
      blankCanvas: canvases.filter((c) => c.ink >= 0 && c.ink <= 20).length,
      canvases: canvases.slice(0, 4),
      under44,
      contrast,
      sayStates,
      tally: (root.querySelector('.ow13-tallytext') || {}).textContent || null,
    };
  });
  m.consoleErrors = page.__errors.slice();
  out.push({ vp: name, ...m });
  await page.context().close();
}
await browser.close();
writeFileSync(`artifacts/wip-b13/shots/${tag}-metrics.json`, JSON.stringify(out, null, 1));
for (const r of out) {
  console.log(`${r.vp}: box ${r.box.w}x${r.box.h} occupancy=${r.occupancy} largestVoid=${r.largestVoid} gap=${r.gap} canvases=${r.nCanvas} blank=${r.blankCanvas} under44=${r.under44.length} errs=${r.consoleErrors.length}`);
  console.log(`   tally="${r.tally}" says=${JSON.stringify(r.sayStates)} contrast=${JSON.stringify(r.contrast)}`);
  if (r.under44.length) console.log('   under44:', JSON.stringify(r.under44.slice(0, 6)));
  if (r.consoleErrors.length) console.log('   errors:', r.consoleErrors.slice(0, 3));
}
